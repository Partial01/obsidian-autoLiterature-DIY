import type { SemanticScholarOptions } from "./types";
import { citationLink, citationUrl, findCitationLinks, validCitationCount, visibleText } from "./citationLinks";
import type { CitationTarget } from "./citationLinks";
import { LEGACY_MARKER, legacyTarget } from "./legacyTracking";
import CrossrefInfo from "./spiders/crossrefInfo";
import SemanticScholarClient from "./spiders/semanticScholarInfo";

interface CitationValue { count: number; target: CitationTarget }
export type CitationLookup = (target: CitationTarget) => Promise<CitationValue | null>;
interface UpdateOptions { semantic: SemanticScholarOptions; refreshCounts: boolean }

export function createCitationLookup(options: SemanticScholarOptions): CitationLookup {
	const crossref = new CrossrefInfo();
	const semantic = new SemanticScholarClient();
	return async (target) => {
		if (target.source === "crossref") {
			const info = await crossref.getInfoByDoi(target.doi);
			return validCitationCount(info.citationCount) ? { count: info.citationCount, target } : null;
		}
		if (!options.enabled) return null;
		const key = target.key;
		const info = await semantic.getInfo({
			s2Id: key.kind === "paper" ? key.id : undefined,
			doi: key.kind === "doi" ? key.id : undefined,
			arxivId: key.kind === "arxiv" ? key.id : undefined,
			apiKey: options.apiKey,
		});
		if (!info || !validCitationCount(info.citationCount)) return null;
		return {
			count: info.citationCount,
			target: info.paperId ? { source: "semantic_scholar", key: { kind: "paper", id: info.paperId } } : target,
		};
	};
}

function samePaper(before: CitationTarget, after: CitationTarget): boolean {
	if (before.source === "crossref") return after.source === "crossref" && before.doi.toLowerCase() === after.doi.toLowerCase();
	if (after.source !== "semantic_scholar") return false;
	if (before.key.kind !== "paper" && after.key.kind === "paper") return true;
	return before.key.kind === after.key.kind && before.key.id.toLowerCase() === after.key.id.toLowerCase();
}

function migrateLine(line: string): { content: string; migrated: boolean; blocked: boolean } {
	const markers = [...line.matchAll(LEGACY_MARKER)];
	if (!markers.length) return { content: line, migrated: false, blocked: false };
	const legacy = markers.length === 1 ? legacyTarget(markers[0][1]) : null;
	if (!legacy) return { content: line, migrated: false, blocked: true };
	const { target } = legacy;
	const comment = markers[0];
	const start = comment.index ?? 0;
	// A comment inside an inline code span is an example, not a migration candidate.
	if (visibleText(line.slice(0, start) + "X".repeat(comment[0].length) + line.slice(start + comment[0].length))[start] !== "X") return { content: line, migrated: false, blocked: true };
	const links = findCitationLinks(line);
	if (links.length > 1 || (links.length === 1 && (!links[0].target || citationUrl(links[0].target) !== citationUrl(target)))) return { content: line, migrated: false, blocked: true };
	let before = line.slice(0, start);
	const after = line.slice(start + comment[0].length);
	if (links.length === 1) return { content: before.replace(/ $/, "") + after, migrated: true, blocked: false };
	const counts = [...visibleText(before).matchAll(/\(Citations (\d+)\)/g)];
	if (counts.length > 1 || (/\(Citations\b/.test(visibleText(before)) && !counts.length)) return { content: line, migrated: false, blocked: true };
	if (counts.length) {
		if (legacy.count === undefined) return { content: line, migrated: false, blocked: true };
		const count = Number(counts[0][1]);
		if (!validCitationCount(count)) return { content: line, migrated: false, blocked: true };
		const at = counts[0].index ?? 0;
		before = before.slice(0, at) + `(${citationLink(target, count)})` + before.slice(at + counts[0][0].length);
		return { content: before.replace(/ $/, "") + after, migrated: true, blocked: false };
	}
	return { content: before.replace(/\s*$/, "") + ` (${citationLink(target)})` + after, migrated: true, blocked: false };
}

// Migration is local and independent of the optional network refresh.
export async function updateCitations(content: string, options: UpdateOptions, lookup: CitationLookup = createCitationLookup(options.semantic)) {
	const result = { content: "", updated: 0, migrated: 0, skipped: 0, failed: 0 };
	const cache = new Map<string, Promise<CitationValue | null>>();
	let fence: { character: string; length: number } | undefined;
	let htmlComment = false;
	for (const raw of content.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g) || []) {
		if (!raw) continue;
		const newline = raw.match(/(?:\r\n|\r|\n)$/)?.[0] || "";
		let line = newline ? raw.slice(0, -newline.length) : raw;
		const boundary = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (fence) {
			if (boundary && boundary[1][0] === fence.character && boundary[1].length >= fence.length && !boundary[2].trim()) fence = undefined;
			result.content += raw; continue;
		}
		if (boundary) { fence = { character: boundary[1][0], length: boundary[1].length }; result.content += raw; continue; }
		const wasComment = htmlComment;
		for (const token of line.matchAll(/<!--|-->/g)) htmlComment = token[0] === "<!--";
		if (wasComment || htmlComment || !/^ {0,3}[-*+]\s+(?:#{1,6}\s+)?\*\*.+?\*\*/.test(line)) { result.content += raw; continue; }
		const migration = migrateLine(line);
		line = migration.content;
		if (migration.migrated) result.migrated++;
		if (migration.blocked) { result.skipped++; result.content += raw; continue; }
		if (!options.refreshCounts) { result.content += line + newline; continue; }
		const links = findCitationLinks(line);
		if (!links.length) { result.content += line + newline; continue; }
		const link = links[0];
		const target = links.length === 1 ? link.target : null;
		if (!target || (target.source === "semantic_scholar" && !options.semantic.enabled)) { result.skipped++; result.content += line + newline; continue; }
		const cacheKey = citationUrl(target);
		let pending = cache.get(cacheKey);
		if (!pending) {
			pending = lookup(target).then((value) => value && validCitationCount(value.count) && samePaper(target, value.target) ? value : null).catch(() => null);
			cache.set(cacheKey, pending);
		}
		const found = await pending;
		if (!found) { result.failed++; result.content += line + newline; continue; }
		result.content += line.slice(0, link.start) + citationLink(found.target, found.count) + line.slice(link.end) + newline;
		result.updated++;
	}
	return result;
}
