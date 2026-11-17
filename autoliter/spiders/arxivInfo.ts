import parser from "rss-parser";
import { assert } from "autoliter/utils";
import type { PaperInfo } from "autoliter/types";
import { requestUrl } from "obsidian";
import { PublicError, errorMessage } from "./response";

const ARXIV_MIN_REQUEST_INTERVAL_MS = 3500;
const ARXIV_MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

class ArxivInfo {
	private static requestQueue: Promise<void> = Promise.resolve();
	private static lastRequestAt = 0;

	private base_url: string;
	private feedParser: parser;

	constructor() {
		this.base_url = "https://export.arxiv.org/api/query";
		this.feedParser = new parser();
	}

	async getInfoByArxivId(arxivId: string): Promise<PaperInfo> {
		// if arxivID's prefix is "arXiv:", remove it
		arxivId = this.normalizeArxivId(arxivId);
		const params = `?${new URLSearchParams({ id_list: arxivId }).toString()}`;
		const url = this.base_url + params;
		try {
			// const results = await this.feedParser.parseURL(this.base_url + params);
			const respnse = await this.requestArxivUrl(url);
			const data = await this.feedParser.parseString(respnse.text); // response format is xml
			assert(data.items.length > 0, "ArxivId returns no result");
			assert(
				data.items.length === 1,
				"ArxivId should return only one result"
			);
			// TODO: get doi info
			// It seems that arxiv api can not get the doi info
			return this.extractInfo(data.items[0], arxivId);
		} catch (error: unknown) {
			throw new PublicError(`arXiv lookup failed: ${errorMessage(error)}`);
		}
	}

	private async requestArxivUrl(url: string) {
		for (let attempt = 0; attempt <= ARXIV_MAX_RETRIES; attempt++) {
			try {
				return await this.queueArxivRequest(() => requestUrl(url));
			} catch (error) {
				const status = this.extractHttpStatus(error);
				const shouldRetry =
					status !== null &&
					[429, 500, 502, 503, 504].includes(status) &&
					attempt < ARXIV_MAX_RETRIES;
				if (!shouldRetry) {
					throw error;
				}
				const backoffMs = Math.min(120000, 15000 * 2 ** attempt);
				await sleep(backoffMs);
			}
		}
		throw new Error("Failed to request arXiv API");
	}

	private async queueArxivRequest<T>(callback: () => Promise<T>): Promise<T> {
		const queuedRequest = ArxivInfo.requestQueue.then(async () => {
			const waitMs =
				ARXIV_MIN_REQUEST_INTERVAL_MS -
				(Date.now() - ArxivInfo.lastRequestAt);
			if (waitMs > 0) {
				await sleep(waitMs);
			}
			ArxivInfo.lastRequestAt = Date.now();
			return callback();
		});

		ArxivInfo.requestQueue = queuedRequest.then(
			() => undefined,
			() => undefined
		);

		return queuedRequest;
	}

	private extractHttpStatus(error: unknown): number | null {
		const status = (error as any)?.status;
		if (typeof status === "number") {
			return status;
		}

		const message = (error as Error | null | undefined)?.message || "";
		const match = message.match(/status\s+(\d+)/i);
		return match ? Number(match[1]) : null;
	}

	extractInfo(data: any, arxivId: string): PaperInfo {
		const title: string = this.clean(data["title"]);
		const author: string = data["author"] || "No author";
		const journal = "Arxiv";
		const date = new Date(data["pubDate"]);
		const [year, month, day] = [
			date.getFullYear(),
			date.getMonth() + 1,
			date.getDate(),
		];
		const pubDate = `${year}-${month}-${day}`;
		const url: string = data["link"];
		const pdfUrl: string = `https://arxiv.org/pdf/${arxivId}.pdf`;
		return {
			title,
			author,
			journal,
			venue: journal,
			pubDate,
			year: String(year),
			url,
			arxivId,
			arxivUrl: url,
			pdfUrl,
		};
	}

	private normalizeArxivId(arxivId: string): string {
		return arxivId
			.replace(/^arXiv:/i, "")
			.split("/")
			.pop()
			?.replace(/v\d+$/i, "") || arxivId;
	}

	private clean(value: string): string {
		return String(value || "").split(/\s+/).join(" ").trim();
	}
}

export default ArxivInfo;
