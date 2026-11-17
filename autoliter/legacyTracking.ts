import type { CitationSource } from "./types";
import { isRecord } from "./spiders/response";
import { targetFromIdentity, validCitationCount } from "./citationLinks";
import type { CitationTarget } from "./citationLinks";

// Read old comments for one-way migration. New entries never write this format.
export const LEGACY_MARKER = /<!-- autoliter: ([^\r\n]*?) -->/g;

export function legacyTarget(json: string): { target: CitationTarget; count?: number } | null {
	try {
		const data: unknown = JSON.parse(json);
		if (!isRecord(data) || data.v !== 1 || typeof data.id !== "string" || !data.id.trim()) return null;
		const fields = new Set(["v", "id", "doi", "arxiv_id", "s2_id", "url", "title", "citation_format", "citation_count", "citation_source", "citation_checked_at"]);
		if (Object.keys(data).some((key) => !fields.has(key))) return null;
		if (data.citation_format !== undefined && data.citation_format !== "inline") return null;
		for (const key of ["doi", "arxiv_id", "s2_id", "url"]) {
			if (data[key] !== undefined && typeof data[key] !== "string") return null;
		}
		let source: CitationSource | undefined;
		if ([data.citation_count, data.citation_source, data.citation_checked_at].some((value) => value !== undefined)) {
			if (!validCitationCount(data.citation_count)
				|| (data.citation_source !== "crossref" && data.citation_source !== "semantic_scholar")
				|| typeof data.citation_checked_at !== "string" || !Number.isFinite(Date.parse(data.citation_checked_at))) return null;
			source = data.citation_source;
		}
		const target = targetFromIdentity({
			doi: typeof data.doi === "string" ? data.doi : undefined,
			arxivId: typeof data.arxiv_id === "string" ? data.arxiv_id : undefined,
			s2Id: typeof data.s2_id === "string" ? data.s2_id : undefined,
		}, source);
		return target ? { target, count: validCitationCount(data.citation_count) ? data.citation_count : undefined } : null;
	} catch {
		return null;
	}
}
