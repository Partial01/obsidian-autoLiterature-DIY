import Spider from "./spiders/spider";
import type { Dict, PaperInfo, SemanticScholarOptions } from "autoliter/types";
import { citationText, citationUrl, targetForPaper, validCitationCount } from "./citationLinks";
import { errorMessage } from "./spiders/response";

interface PaperEntry {
	origin: string;
	paperID: string;
	info?: PaperInfo;
	error?: string;
}

const LINK_ORDER = ["pdf", "arxiv", "s2"];

const VENUE_ALIASES: Record<string, string> = {
	"Neural Information Processing Systems": "NeurIPS",
	neurips: "NeurIPS",
	"Computer Vision and Pattern Recognition": "CVPR",
	cvpr: "CVPR",
	"international conference on computer vision": "ICCV",
	iccv: "ICCV",
	"european conference on computer vision": "ECCV",
	eccv: "ECCV",
	"international conference on machine learning": "ICML",
	icml: "ICML",
	"international conference on learning representations": "ICLR",
	iclr: "ICLR",
	"association for computational linguistics": "ACL",
	acl: "ACL",
	"empirical methods in natural language processing": "EMNLP",
	emnlp: "EMNLP",
	aaai: "AAAI",
	ijcai: "IJCAI",
};

async function getPaperEntries(
	m: RegExpExecArray[],
	semanticOptions?: SemanticScholarOptions
): Promise<PaperEntry[]> {
	const spider = new Spider();
	const cache = new Map<string, Promise<PaperInfo>>();

	return await Promise.all(
		m.map(async (literature) => {
			const origin = literature[0];
			const paperID = extractPaperId(origin);
			try {
				let pending = cache.get(paperID);
				if (!pending) {
					pending = spider.getPaperInfo(paperID, semanticOptions);
					cache.set(paperID, pending);
				}
				const info = await pending;
				info.id = paperID;
				return { origin, paperID, info };
			} catch (error: unknown) {
				return {
					origin,
					paperID,
					error: `Error in getPaperEntries: ${errorMessage(error)}`,
				};
			}
		})
	);
}

async function getReplaceDict(
	m: RegExpExecArray[],
	outputFormat: string,
	semanticOptions?: SemanticScholarOptions
): Promise<[Dict, string[], PaperInfo[]]> {
	const entries = await getPaperEntries(m, semanticOptions);
	return buildReplaceDict(entries, outputFormat);
}

function buildReplaceDict(
	entries: PaperEntry[],
	outputFormat: string
): [Dict, string[], PaperInfo[]] {
	const replaceDict: Dict = {};
	const pdfUrls: string[] = [];
	const paperInfo: PaperInfo[] = [];

	entries.forEach((entry) => {
		if (entry.error || !entry.info) {
			replaceDict[entry.origin] = entry.origin;
			pdfUrls.push("");
			paperInfo.push({});
			return;
		}

		normalizePaperInfo(entry.info);
		replaceDict[entry.origin] = formatPaperInfo(entry.info, outputFormat);
		pdfUrls.push(entry.info.pdfUrl || "");
		paperInfo.push(entry.info);
	});

	return [replaceDict, pdfUrls, paperInfo];
}

function formatPaperInfo(info: PaperInfo, outputFormat: string): string {
	normalizePaperInfo(info);
	const target = targetForPaper(info);
	const values: Record<string, string> = {
		title: text(info.title),
		author: firstAuthor(info),
		journal: text(info.journal),
		pubDate: text(info.pubDate),
		url: text(info.url),
		year: text(info.year),
		venue: text(info.venue),
		doi: text(info.doi),
		doiUrl: text(info.doiUrl),
		arxivId: text(info.arxivId),
		arxivUrl: text(info.arxivUrl),
		pdfUrl: text(info.pdfUrl),
		localPdfPath: text(info.localPdfPath),
		s2Url: text(info.s2Url),
		citationCount:
			info.citationCount === undefined || info.citationCount === null
				? ""
				: String(info.citationCount),
		citationText:
			citationText(info),
		citationUrl: target ? citationUrl(target) : "",
		links: buildLinks(info),
		linksText: buildLinks(info) ? ` ${buildLinks(info)}` : "",
		venueYear: buildVenueYear(info),
	};

	const formatted = outputFormat.replace(/\$\{([^}]+)\}/g, (match, key) => {
		return Object.prototype.hasOwnProperty.call(values, key)
			? values[key]
			: match;
	});
	return formatted;
}

function normalizePaperInfo(info: PaperInfo): PaperInfo {
	info.title = cleanValue(info.title) || "No title";
	info.author = cleanValue(info.author) || "";
	info.journal = cleanValue(info.journal) || "No journal";
	info.pubDate = cleanValue(info.pubDate) || "";
	info.year = cleanValue(info.year) || getYear(info.pubDate);
	info.venue = aliasVenue(
		cleanValue(info.shortContainerTitle) ||
			cleanValue(info.containerTitle) ||
			cleanValue(info.venue) ||
			cleanValue(info.journal)
	);
	info.doi = cleanDoi(info.doi || (info.idType === "doi" ? info.id : ""));
	info.doiUrl =
		cleanValue(info.doiUrl) || (info.doi ? `https://doi.org/${info.doi}` : "");
	info.arxivId = normalizeArxivId(
		info.arxivId || (info.idType === "arxivId" ? info.id : "")
	);
	info.arxivUrl =
		cleanValue(info.arxivUrl) ||
		(info.arxivId ? `https://arxiv.org/abs/${info.arxivId}` : "");
	info.s2Url = cleanValue(info.s2Url || info.semanticScholar?.url);
	info.citationCount =
		info.semanticScholar?.citationCount ?? info.citationCount;
	if (!validCitationCount(info.citationCount)) info.citationCount = undefined;
	info.pdfUrl =
		cleanValue(info.localPdfPath) ||
		cleanValue(info.pdfUrl) ||
		cleanValue(info.semanticScholar?.openAccessPdf?.url) ||
		"";
	return info;
}

function buildLinks(info: PaperInfo): string {
	const urls: Record<string, string | undefined> = {
		pdf: info.pdfUrl,
		arxiv: info.arxivUrl,
		s2: info.s2Url,
	};
	const labels: Record<string, string> = {
		pdf: "PDF",
		arxiv: "arXiv",
		s2: "S2",
	};
	return LINK_ORDER.map((kind) => {
		const url = urls[kind];
		return url ? `([${labels[kind]}](${url}))` : "";
	})
		.filter(Boolean)
		.join(" ");
}

function buildVenueYear(info: PaperInfo): string {
	const venue = cleanValue(info.venue);
	const year = cleanValue(info.year);
	if (venue && year) {
		return ` ${venue}, ${year}`;
	}
	if (venue) {
		return ` ${venue}`;
	}
	if (year) {
		return ` ${year}`;
	}
	return "";
}

function firstAuthor(info: PaperInfo): string {
	const authors = cleanValue(info.author);
	if (authors) {
		const parts = authors.split(" and ").filter(Boolean);
		return parts.length > 1 ? `${parts[0]} et al.` : parts[0];
	}

	const s2Authors = info.semanticScholar?.authors || [];
	if (s2Authors.length) {
		const first = s2Authors[0].name || "No author";
		return s2Authors.length > 1 ? `${first} et al.` : first;
	}

	return "No author";
}

function extractPaperId(literature: string): string {
	return (literature.split("{").pop()?.split("}")[0] || "").trim();
}

function cleanValue(value: any): string {
	if (Array.isArray(value)) {
		value = value[0];
	}
	if (value === undefined || value === null) {
		return "";
	}
	const clean = String(value).split(/\s+/).join(" ").trim();
	return clean && !["none", "no journal"].includes(clean.toLowerCase())
		? clean
		: "";
}

function aliasVenue(venue: string): string {
	if (!venue) {
		return "";
	}
	const lowerVenue = venue.toLowerCase();
	for (const [key, alias] of Object.entries(VENUE_ALIASES)) {
		if (lowerVenue.includes(key.toLowerCase())) {
			return alias;
		}
	}
	return venue;
}

function getYear(pubDate?: string): string {
	return pubDate?.match(/\d{4}/)?.[0] || "";
}

function cleanDoi(doi?: string): string {
	return cleanValue(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

function normalizeArxivId(arxivId?: string): string {
	if (!arxivId) {
		return "";
	}
	return arxivId
		.replace(/^arXiv:/i, "")
		.split("/")
		.pop()
		?.replace(/v\d+$/i, "") || arxivId;
}

function text(value: any): string {
	return value === undefined || value === null ? "" : String(value);
}

function assert(condition: any, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function sanitizeFileName(
	fileName: string,
	pdfUrl: string,
	paperInfo: PaperInfo,
	nameFormat: "title" | "id" | "custom",
	customFormat: string
): string {
	let name = "";

	switch (nameFormat) {
		case "id":
			name =
				normalizeArxivIdFromPdfUrl(pdfUrl) ||
				paperInfo.doi ||
				paperInfo.id ||
				paperInfo.title ||
				fileName;
			break;
		case "custom":
			name = customFormat.replace(/\$\{([^}]+)\}/g, (match, key) => {
				const value = paperInfo[key];
				return value === undefined || value === null ? "" : String(value);
			});
			break;
		case "title":
		default:
			name = paperInfo.title || fileName;
			break;
	}

	name = cleanValue(name).replace(/\.pdf$/i, "");
	name = name.replace(/[/\\?%*:|"<>]/g, "-");

	const maxLength = 100;
	if (name.length > maxLength) {
		name = name.slice(0, maxLength - 4);
	}

	return `${name || "paper"}.pdf`;
}

function normalizeArxivIdFromPdfUrl(pdfUrl: string): string {
	const arxivMatch = pdfUrl.match(/arxiv\.org\/pdf\/([^/?#]+)\.pdf/i);
	return arxivMatch ? normalizeArxivId(arxivMatch[1]) : "";
}

export {
	buildReplaceDict,
	formatPaperInfo,
	getPaperEntries,
	getReplaceDict,
	normalizePaperInfo,
	assert,
	sanitizeFileName,
};
export type { PaperEntry };
