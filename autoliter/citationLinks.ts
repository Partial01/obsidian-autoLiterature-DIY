import type { PaperInfo } from "./types";

export type SemanticKey = { kind: "paper" | "doi" | "arxiv"; id: string };
export type CitationTarget =
	| { source: "crossref"; doi: string }
	| { source: "semantic_scholar"; key: SemanticKey };

export function validCitationCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validDoi(value: string): boolean {
	return /^10\.\d{4,9}\/\S+$/i.test(value);
}

function validKey(key: SemanticKey): boolean {
	if (key.kind === "paper") return /^[a-f\d]{40}$/i.test(key.id);
	if (key.kind === "doi") return validDoi(key.id);
	return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?$/i.test(key.id);
}

function encodePath(value: string): string {
	return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function citationUrl(target: CitationTarget): string {
	if (target.source === "crossref") return `https://api.crossref.org/works/${encodePath(target.doi)}`;
	const key = target.key;
	if (key.kind === "paper") return `https://www.semanticscholar.org/paper/${key.id}`;
	return `https://api.semanticscholar.org/graph/v1/paper/${encodePath(`${key.kind === "doi" ? "DOI" : "ARXIV"}:${key.id}`)}`;
}

// Parse a known provider destination, never an arbitrary user-supplied fetch URL.
export function targetFromUrl(value: string): CitationTarget | null {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
		if (url.hostname === "api.crossref.org" && url.pathname.startsWith("/works/")) {
			const doi = decodeURIComponent(url.pathname.slice("/works/".length));
			return validDoi(doi) ? { source: "crossref", doi } : null;
		}
		if (["www.semanticscholar.org", "semanticscholar.org"].includes(url.hostname) && url.pathname.startsWith("/paper/")) {
			const id = url.pathname.replace(/\/$/, "").split("/").pop() || "";
			return /^[a-f\d]{40}$/i.test(id) ? { source: "semantic_scholar", key: { kind: "paper", id } } : null;
		}
		const prefix = "/graph/v1/paper/";
		if (url.hostname === "api.semanticscholar.org" && url.pathname.startsWith(prefix)) {
			const raw = decodeURIComponent(url.pathname.slice(prefix.length));
			const key: SemanticKey = /^DOI:/i.test(raw) ? { kind: "doi", id: raw.slice(4) }
				: /^ARXIV:/i.test(raw) ? { kind: "arxiv", id: raw.slice(6) } : { kind: "paper", id: raw };
			return validKey(key) ? { source: "semantic_scholar", key } : null;
		}
		return null;
	} catch {
		return null;
	}
}

export function targetFromIdentity(identity: { doi?: string; arxivId?: string; s2Id?: string }, source?: "crossref" | "semantic_scholar"): CitationTarget | null {
	if (source !== "crossref") {
		if (identity.s2Id && validKey({ kind: "paper", id: identity.s2Id })) return { source: "semantic_scholar", key: { kind: "paper", id: identity.s2Id } };
		if (source === "semantic_scholar" && identity.doi && validDoi(identity.doi)) return { source, key: { kind: "doi", id: identity.doi } };
		if (identity.arxivId && validKey({ kind: "arxiv", id: identity.arxivId })) return { source: "semantic_scholar", key: { kind: "arxiv", id: identity.arxivId } };
	}
	return source !== "semantic_scholar" && identity.doi && validDoi(identity.doi) ? { source: "crossref", doi: identity.doi } : null;
}

export function targetForPaper(info: PaperInfo): CitationTarget | null {
	const s2 = info.semanticScholar;
	const parsedS2 = info.s2Url ? targetFromUrl(info.s2Url) : null;
	return targetFromIdentity({
		doi: info.doi || s2?.externalIds?.DOI,
		arxivId: info.arxivId || s2?.externalIds?.ArXiv,
		s2Id: s2?.paperId || (parsedS2?.source === "semantic_scholar" && parsedS2.key.kind === "paper" ? parsedS2.key.id : undefined),
	}, info.citation?.source);
}

export function citationLink(target: CitationTarget, count?: number): string {
	return `[Citations${validCitationCount(count) ? ` ${count}` : ""}](${citationUrl(target)})`;
}

export function citationText(info: PaperInfo): string {
	const target = targetForPaper(info);
	if (target) return ` (${citationLink(target, info.citationCount)})`;
	return validCitationCount(info.citationCount) ? ` (Citations ${info.citationCount})` : "";
}

// Mask inline examples and comments while keeping string offsets intact.
export function visibleText(line: string): string {
	let masked = line;
	for (let at = 0; at < line.length;) {
		if (line.startsWith("<!--", at)) {
			const close = line.indexOf("-->", at + 4);
			const end = close < 0 ? line.length : close + 3;
			masked = masked.slice(0, at) + " ".repeat(end - at) + masked.slice(end);
			at = end;
		} else if (line[at] === "`") {
			const run = line.slice(at).match(/^`+/)?.[0] || "`";
			let end = -1;
			for (const candidate of line.slice(at + run.length).matchAll(/`+/g)) {
				if (candidate[0].length === run.length) { end = at + run.length + (candidate.index ?? 0) + run.length; break; }
			}
			if (end >= 0) {
				masked = masked.slice(0, at) + " ".repeat(end - at) + masked.slice(end);
				at = end;
			} else at += run.length;
		} else at++;
	}
	return masked;
}

export interface CitationLinkMatch {
	start: number;
	end: number;
	target: CitationTarget | null;
	count?: number;
}

export function findCitationLinks(line: string): CitationLinkMatch[] {
	const masked = visibleText(line);
	return [...masked.matchAll(/\[Citations([^\]\r\n]*)\]\(([^\s()]*)\)/g)].map((match) => {
		const label = match[1].trim();
		const count = label ? Number(label) : undefined;
		const at = match.index ?? 0;
		const escaped = ((masked.slice(0, at).match(/\\+$/)?.[0].length || 0) % 2) === 1;
		return {
			start: at, end: at + match[0].length,
			target: escaped || (label && (!/^\d+$/.test(label) || !validCitationCount(count))) || masked[at - 1] === "!" ? null : targetFromUrl(match[2]),
			count,
		};
	});
}
