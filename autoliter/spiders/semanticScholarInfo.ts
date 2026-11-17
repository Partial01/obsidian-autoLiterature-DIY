import { requestUrl } from "obsidian";
import type { SemanticScholarInfo } from "autoliter/types";
import { isRecord, withTimeout } from "./response";

const FIELDS = "paperId,externalIds,title,year,venue,url,citationCount,openAccessPdf,authors";
const BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/";
const SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search";
const MIN_REQUEST_INTERVAL_MS = 1000;

class SemanticScholarClient {
	private static lastRequestTime = 0;
	private static requestQueue: Promise<void> = Promise.resolve();

	async getInfo(params: {
		s2Id?: string;
		doi?: string;
		arxivId?: string;
		title?: string;
		apiKey?: string;
	}): Promise<SemanticScholarInfo | null> {
		const paperKey = params.s2Id || this.getPaperKey(params.doi, params.arxivId);
		if (paperKey) {
			const direct = await this.requestJson(
				`${BASE_URL}${encodeURIComponent(paperKey)}`,
				{ fields: FIELDS },
				params.apiKey
			);
			const info = this.parsePaper(direct);
			if (info) {
				return info;
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
	): Promise<unknown> {
		try {
			await this.throttle();
			const query = new URLSearchParams(params).toString();
			const headers: Record<string, string> = {};
			if (apiKey) {
				headers["x-api-key"] = apiKey;
			}
			const response = await withTimeout(requestUrl({
				url: `${url}?${query}`,
				method: "GET",
				headers,
			}), "Semantic Scholar");
			return response.json && typeof response.json === "object"
				? response.json
				: null;
		} catch (error) {
			return null;
		}
	}

	private async throttle(): Promise<void> {
		SemanticScholarClient.requestQueue = SemanticScholarClient.requestQueue.then(async () => {
			const elapsed = Date.now() - SemanticScholarClient.lastRequestTime;
			if (SemanticScholarClient.lastRequestTime && elapsed < MIN_REQUEST_INTERVAL_MS) {
				await new Promise((resolve) =>
					setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
				);
			}
			SemanticScholarClient.lastRequestTime = Date.now();
		});
		return SemanticScholarClient.requestQueue;
	}

	private selectExactTitleMatch(
		searchData: unknown,
		title: string
	): SemanticScholarInfo | null {
		const papers = isRecord(searchData) && Array.isArray(searchData.data) ? searchData.data : [];
		const normalizedTitle = this.normalizeTitle(title);
		const matches = papers.map((paper: unknown) => this.parsePaper(paper))
			.filter((paper): paper is SemanticScholarInfo => paper !== null
				&& this.normalizeTitle(paper.title) === normalizedTitle);
		return matches.length === 1 ? matches[0] : null;
	}

	private parsePaper(data: unknown): SemanticScholarInfo | null {
		if (!isRecord(data) || typeof data.title !== "string" || !data.title.trim()) return null;
		const count = data.citationCount;
		return {
			paperId: typeof data.paperId === "string" && /^[a-f\d]{40}$/i.test(data.paperId) ? data.paperId : undefined,
			externalIds: isRecord(data.externalIds) ? {
				DOI: typeof data.externalIds.DOI === "string" ? data.externalIds.DOI : undefined,
				ArXiv: typeof data.externalIds.ArXiv === "string" ? data.externalIds.ArXiv : undefined,
			} : undefined,
			title: data.title,
			year: typeof data.year === "number" ? data.year : undefined,
			venue: typeof data.venue === "string" ? data.venue : undefined,
			url: typeof data.url === "string" ? data.url : undefined,
			citationCount: typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : undefined,
			openAccessPdf: isRecord(data.openAccessPdf) && typeof data.openAccessPdf.url === "string"
				? { url: data.openAccessPdf.url } : undefined,
			authors: Array.isArray(data.authors) ? data.authors.filter(isRecord)
				.filter((author) => typeof author.name === "string").map((author) => ({ name: String(author.name) })) : [],
		};
	}

	private normalizeTitle(title?: string): string {
		return title ? title.replace(/[{}]/g, "").split(/\s+/).join(" ").trim().toLowerCase() : "";
	}
}

export default SemanticScholarClient;
