import { requestUrl } from "obsidian";
import type { PaperInfo } from "autoliter/types";
import { withTimeout, PublicError, errorMessage } from "./response";

export function isUsenixUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && ["usenix.org", "www.usenix.org"].includes(url.hostname)
			&& !url.username && !url.password && !url.port
			&& /^\/conference\/[\w-]+\/presentation\/[\w-]+\/?$/.test(url.pathname);
	} catch {
		return false;
	}
}

function decodeEntities(value: string): string {
	const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
	return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, key: string) => {
		if (key[0] !== "#") return named[key.toLowerCase()] || entity;
		const number = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
		return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
	});
}

export default class UsenixInfo {
	async getInfo(url: string): Promise<PaperInfo> {
		if (!isUsenixUrl(url)) throw new PublicError("Use an HTTPS USENIX presentation URL");
		try {
			const response = await withTimeout(requestUrl({ url, throw: false }), "USENIX");
			if (response.status !== 200) throw new PublicError(`USENIX HTTP ${response.status}`);
			return this.extractInfo(response.text, url);
		} catch (error: unknown) {
			throw new PublicError(`USENIX lookup failed: ${errorMessage(error)}`);
		}
	}

	extractInfo(html: string, url: string): PaperInfo {
		const metadata = new Map<string, string[]>();
		for (const tag of html.match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || []) {
			const attributes: Record<string, string> = {};
			const pattern = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
			let match;
			while ((match = pattern.exec(tag)) !== null) {
				attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]).trim();
			}
			const name = attributes.name?.toLowerCase();
			if (name?.startsWith("citation_") && attributes.content) {
				metadata.set(name, [...(metadata.get(name) || []), attributes.content]);
			}
		}
		const first = (name: string) => metadata.get(name)?.[0] || "";
		const title = first("citation_title").replace(/[{}]/g, "");
		if (!title) throw new PublicError("USENIX page has no citation_title");
		const journal = first("citation_conference_title");
		const pubDate = first("citation_publication_date");
		const doi = first("citation_doi");
		const rawPdf = first("citation_pdf_url");
		const pdf = rawPdf ? new URL(rawPdf, url) : undefined;
		return {
			title, author: (metadata.get("citation_author") || []).join(" and "),
			journal, venue: journal, pubDate, year: pubDate.match(/\d{4}/)?.[0] || "", url,
			doi, doiUrl: doi ? `https://doi.org/${doi}` : "",
			pdfUrl: pdf?.protocol === "https:" ? pdf.href : "",
		};
	}
}
