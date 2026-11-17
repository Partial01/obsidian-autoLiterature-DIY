import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Vault,
	requestUrl,
} from "obsidian";
import PatternRecognizer from "autoliter/patternRecognizer";
import { buildReplaceDict, getPaperEntries } from "autoliter/utils";
import { AutoLiterSettingTab } from "autoliter/settings";
import { downloadPdf } from "autoliter/pdfManager";
import type { PaperInfo } from "autoliter/types";
import { updateCitations } from "autoliter/citations";

interface AutoLiterSettings {
	outputFormat: string;
	regExp: string;
	autoDownloadPDF: boolean;
	pdfDownloadPathBase: string;
	pdfDownloadPath: string;
	pdfNameFormat: "title" | "id" | "custom";
	customPdfNameFormat: string;
	enableSemanticScholar: boolean;
	semanticScholarApiKey: string;
	refreshCitationCounts: boolean;
}

const DEFAULT_SETTINGS: AutoLiterSettings = {
	// example: "------\n**${title}** ([link](${url}))\n\t- *${author} et.al.*\n\t- ${journal}\n\t- ${pubDate}\n\n------\n"
	outputFormat:
		"- **${title}**. *${author}*${venueYear}${linksText}${citationText}\n\t- ",
	regExp: "- \\{[^{}\\r\\n]+\\}",
	autoDownloadPDF: false,
	pdfDownloadPathBase: "vault",
	pdfDownloadPath: "pdfs",
	pdfNameFormat: "title",
	customPdfNameFormat: "${title}",
	enableSemanticScholar: false,
	semanticScholarApiKey: "",
	refreshCitationCounts: false,
};

export default class AutoLiter extends Plugin {
	settings: AutoLiterSettings;
	paperRecognizer: PatternRecognizer;
	private updatingFiles = new Set<string>();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoLiterSettingTab(this.app, this));

		this.paperRecognizer = new PatternRecognizer(`${this.settings.regExp}`); // g is must

		// Icon in the left ribbon: update active file
		const ribbonIconEl = this.addRibbonIcon(
			"book-down",
			"AutoLiter",
			async (evt: MouseEvent) => {
				new Notice("start updating vault.");
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					await this.updateFile(activeFile, this.paperRecognizer);
				}
				new Notice("finish updating vault.");
			}
		);

		// Command: update the whole vault
		this.addCommand({
			id: "update-vault",
			name: "Update the whole vault",
			editorCallback: async (editor: Editor) => {
				new Notice("start updating vault.");
				for (const file of this.app.vault.getMarkdownFiles()) {
					await this.updateFile(file, this.paperRecognizer);
				}
				new Notice("finish updating vault.");
			},
		});

		// Command: update selected text
		this.addCommand({
			id: "update-selected",
			name: "Update selected text",
			editorCallback: async (editor: Editor) => {
				new Notice("start updating selection.");
				const selection = editor.getSelection();
				const from = editor.getCursor("from");
				const to = editor.getCursor("to");
				const updated = await this.updateSelected(selection, this.paperRecognizer);
				const currentFrom = editor.getCursor("from");
				const currentTo = editor.getCursor("to");
				if (editor.getSelection() === selection && from.line === currentFrom.line && from.ch === currentFrom.ch
					&& to.line === currentTo.line && to.ch === currentTo.ch) {
					editor.replaceSelection(updated);
				} else {
					new Notice("Selection changed during lookup; skipped to preserve your edits.");
				}
				new Notice("finish updating selection.");
			},
		});
	}

	onunload() {}

	async updateFile(file: TFile, paperRecognizer: PatternRecognizer) {
		if (this.updatingFiles.has(file.path)) return;
		this.updatingFiles.add(file.path);
		try {
			const content = await this.app.vault.read(file);
			const updated = await this.prepareUpdate(content, paperRecognizer, true);
			if (updated === content) return;
			await this.app.vault.process(file, (current) => {
				if (current !== content) {
					new Notice("Note changed during lookup; skipped to preserve your edits.");
					return current;
				}
				return updated;
			});
		} finally {
			this.updatingFiles.delete(file.path);
		}
	}

	async updateSelected(
		selection: string,
		paperRecognizer: PatternRecognizer
	) {
		return this.prepareUpdate(selection, paperRecognizer, false);
	}

	private async prepareUpdate(content: string, recognizer: PatternRecognizer, download: boolean): Promise<string> {
		const options = this.getSemanticScholarOptions();
		let updated = content;
		// Refresh the original entries first, so new placeholders are fetched only once per click.
		const result = await updateCitations(content, { semantic: options, refreshCounts: this.settings.refreshCitationCounts });
		updated = result.content;
		if (result.updated || result.failed || result.skipped || result.migrated) {
			new Notice(`Citations: ${result.updated} refreshed, ${result.migrated} comments converted, ${result.failed} unavailable, ${result.skipped} skipped.`);
		}
		const matches = recognizer.findAll(updated);
		if (!matches?.length) return updated;
		const entries = await getPaperEntries(matches, options);
		if (download) await this.downloadPdfsForEntries(entries);
		const [replacements] = buildReplaceDict(entries, this.settings.outputFormat);
		// Apply the original match positions backwards, including repeated identical placeholders.
		for (const match of [...matches].reverse()) {
			updated = updated.slice(0, match.index) + replacements[match[0]] + updated.slice(match.index + match[0].length);
		}
		return updated;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		if (["- {.{3,}}", "- \\{.{3,}\\}"].includes(this.settings.regExp)) {
			this.settings.regExp = DEFAULT_SETTINGS.regExp;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	joinPaths(basePath: string, relativePath: string) {
		if (relativePath.startsWith("./")) {
			return basePath + relativePath.slice(1);
		} else {
			return basePath + "/" + relativePath;
		}
	}

	private getSemanticScholarOptions() {
		return {
			enabled: this.settings.enableSemanticScholar,
			apiKey: this.settings.semanticScholarApiKey.trim(),
		};
	}

	private async downloadPdfsForEntries(
		entries: Awaited<ReturnType<typeof getPaperEntries>>
	): Promise<void> {
		if (!this.settings.autoDownloadPDF) {
			return;
		}

		for (const entry of entries) {
			const info = entry.info as PaperInfo | undefined;
			if (!info?.pdfUrl) {
				continue;
			}
			const localPdfPath = await downloadPdf(
				this.app,
				info.pdfUrl,
				info,
				this.settings.pdfNameFormat,
				this.settings.customPdfNameFormat,
				this.settings.pdfDownloadPathBase,
				this.settings.pdfDownloadPath
			);
			if (localPdfPath) {
				info.localPdfPath = localPdfPath;
				info.pdfUrl = localPdfPath;
			}
		}
	}
}
