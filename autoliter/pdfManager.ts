import { App, Notice, requestUrl } from "obsidian";
import { sanitizeFileName } from "./utils";
import type { PaperInfo } from "autoliter/types";
import { errorMessage } from "./spiders/response";

export async function downloadPdf(
	app: App,
	pdfUrl: string,
	paperInfo: PaperInfo,
	pdfNameFormat: "title" | "id" | "custom",
	customPdfNameFormat: string,
	pdfDownloadPathBase: string,
	pdfDownloadPath: string
): Promise<string | null> {
	try {
		if (!pdfUrl) {
			return null;
		}

		const fileName = sanitizeFileName(
			paperInfo.title || paperInfo.id || "paper",
			pdfUrl,
			paperInfo,
			pdfNameFormat,
			customPdfNameFormat
		);

		const folderPath = await getPdfFolderPath(
			app,
			pdfDownloadPathBase,
			pdfDownloadPath
		);
		if (!folderPath) {
			return null;
		}

		const response = await requestUrl({
			url: pdfUrl,
			method: "GET",
			contentType: "application/pdf",
		});
		const uint8Array = new Uint8Array(response.arrayBuffer);

		const filePath = joinPaths(folderPath, fileName);
		if (app.vault.getAbstractFileByPath(filePath)) {
			return filePath;
		}
		await app.vault.createBinary(filePath, uint8Array);
		new Notice(`Downloaded PDF: ${fileName}`);
		return filePath;
	} catch (error: unknown) {
		new Notice(`Error downloading PDF: ${errorMessage(error)}`);
		return null;
	}
}

export async function getPdfFolderPath(
	app: App,
	pdfDownloadPathBase: string,
	pdfDownloadPath: string
): Promise<string | null> {
	let folderPath = null;
	try {
		if (pdfDownloadPathBase === "mdFile") {
			const activeFile = app.workspace.getActiveFile();
			if (activeFile) {
				const activeFileFolder = activeFile.path
					.split("/")
					.slice(0, -1)
					.join("/");
				folderPath = joinPaths(activeFileFolder, pdfDownloadPath);
				await app.vault.createFolder(folderPath);
			}
		} else {
			folderPath = pdfDownloadPath;
			await app.vault.createFolder(pdfDownloadPath);
		}
	} catch (error) {
		// Ignore if folder already exists.
	}
	return folderPath;
}

export function joinPaths(basePath: string, relativePath: string): string {
	if (!basePath) {
		return relativePath;
	}
	if (relativePath.startsWith("./")) {
		return basePath + relativePath.slice(1);
	}
	return basePath + "/" + relativePath;
}
