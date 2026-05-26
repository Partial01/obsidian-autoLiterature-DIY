import { requestUrl } from "obsidian";
import type { SemanticScholarInfo } from "autoliter/types";

const FIELDS = "title,year,venue,url,citationCount,openAccessPdf,authors";
const BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/";
const SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const MIN_REQUEST_INTERVAL_MS = 1000;

class SemanticScholarClient {
	private lastRequestTime = 0;
	private requestQueue: Promise<void> = Promise.resolve();

	async getInfo(params: {
		doi?: string;
		arxivId?: string;
		title?: string;
		apiKey?: string;
	}): Promise<SemanticScholarInfo | null> {
		const paperKey = this.getPaperKey(params.doi, params.arxivId);
		if (paperKey) {
			const direct = await this.requestJson(
				`${BASE_URL}${encodeURIComponent(paperKey)}`,
				{ fields: FIELDS },
				params.apiKey
			);
			if (direct) {
				return direct;
			}
		}

		if (params.title) {
			const search = await this.requestJson(
				SEARCH_URL,
				{ query: params.title, limit: "5", fields: FIELDS },
				params.apiKey
			);
			return this.selectExactTitleMatch(search, params.title);
		}

		return null;
	}

	private getPaperKey(doi?: string, arxivId?: string): string | null {
		if (doi) {
			return `DOI:${doi}`;
		}
		if (arxivId) {
			return `ARXIV:${this.normalizeArxivId(arxivId)}`;
		}
		return null;
	}

	private normalizeArxivId(arxivId: string): string {
		return arxivId
			.replace(/^arXiv:/i, "")
			.split("/")
			.pop()
			?.replace(/v\d+$/i, "") || arxivId;
	}

	private async requestJson(
		url: string,
		params: Record<string, string>,
		apiKey?: string
	): Promise<any | null> {
		try {
			await this.throttle();
			const query = new URLSearchParams(params).toString();
			const headers: Record<string, string> = {};
			if (apiKey) {
				headers["x-api-key"] = apiKey;
			}
			const response = await requestUrl({
				url: `${url}?${query}`,
				method: "GET",
				headers,
			});
			return response.json && typeof response.json === "object"
				? response.json
				: null;
		} catch (error) {
			return null;
		}
	}

	private async throttle(): Promise<void> {
		this.requestQueue = this.requestQueue.then(async () => {
			const elapsed = Date.now() - this.lastRequestTime;
			if (this.lastRequestTime && elapsed < MIN_REQUEST_INTERVAL_MS) {
				await new Promise((resolve) =>
					setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
				);
			}
			this.lastRequestTime = Date.now();
		});
		return this.requestQueue;
	}

	private selectExactTitleMatch(
		searchData: any,
		title: string
	): SemanticScholarInfo | null {
		const papers = Array.isArray(searchData?.data) ? searchData.data : [];
		const normalizedTitle = this.normalizeTitle(title);
		return (
			papers.find(
				(paper: SemanticScholarInfo) =>
					this.normalizeTitle(paper.title) === normalizedTitle
			) || null
		);
	}

	private normalizeTitle(title?: string): string {
		return title ? title.split(/\s+/).join(" ").trim().toLowerCase() : "";
	}
}

export default SemanticScholarClient;
