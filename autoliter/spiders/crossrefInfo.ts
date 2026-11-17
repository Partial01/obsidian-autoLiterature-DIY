import type { PaperInfo } from "autoliter/types";
import { requestUrl } from "obsidian";
import { isRecord, strings, errorMessage, withTimeout, PublicError } from "./response";

// const HEADERS = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:27.0) Gecko/20100101 Firefox/43.0'};

class CrossrefInfo {
    private base_url: string;

    constructor() {
        this.base_url = "https://api.crossref.org/";
    }

    async getInfoByDoi(input: string): Promise<PaperInfo> {
        const doi = input.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
        let response;
        try {
            response = await withTimeout(requestUrl({
                url: `${this.base_url}works/${encodeURIComponent(doi)}`,
                throw: false,
            }), "Crossref");
        } catch (error: unknown) {
            throw new PublicError(`Crossref request failed: ${errorMessage(error)}`);
        }
        if (response.status !== 200) {
            const hint = response.status === 404
                ? doi.startsWith("10.5555/")
                    ? "No Crossref record. 10.5555 contains test/unmaintained records; an ACM catalog ID may not be a registered DOI. Use the official USENIX presentation URL when available."
                    : "No Crossref record for this DOI."
                : response.status === 429 ? "Rate limited; retry later." : "Provider refused or failed the request.";
            throw new PublicError(`Crossref HTTP ${response.status}: ${hint}`);
        }
        try {
            const payload: unknown = response.json;
            if (!isRecord(payload)) throw new PublicError("Invalid response envelope");
            return this.extractInfo(payload.message);
        } catch (error: unknown) {
            throw new PublicError(`Crossref metadata error: ${errorMessage(error)}`);
        }
    }

    extractInfo(data: unknown): PaperInfo {
        if (!isRecord(data)) throw new PublicError("Missing work metadata");
        const title = strings(data.title)[0];
        if (!title) throw new PublicError("Missing title");
        const author = Array.isArray(data.author) ? data.author.filter(isRecord).map((item) =>
            [item.given, item.family, item.name].filter((value) => typeof value === "string").join(" ").trim()
        ).filter(Boolean).join(" and ") : "";
        const shortContainerTitle = strings(data['short-container-title'])[0];
        const containerTitle = strings(data['container-title'])[0];
        const journal = shortContainerTitle || containerTitle || "No journal";
        const date = [data.published, data['published-print'], data['published-online'], data.issued]
            .filter(isRecord).map((item) => item['date-parts'])
            .find((parts) => Array.isArray(parts) && Array.isArray(parts[0]));
        const dateParts = Array.isArray(date) && Array.isArray(date[0])
            ? date[0].filter((part: unknown) => typeof part === "number" && Number.isInteger(part)) : [];
        const pubDate = dateParts.join('-');
        const year = dateParts[0] ? String(dateParts[0]) : "";
        const doi = typeof data.DOI === "string" ? data.DOI : "";
        const doiUrl = doi ? `https://doi.org/${doi}` : "";
        const url = typeof data.URL === "string" ? data.URL : doiUrl;
        const pdf = Array.isArray(data.link) ? data.link.filter(isRecord).find((link) =>
            link['content-type'] === "application/pdf" && typeof link.URL === "string"
        ) : undefined;
        const pdfUrl = typeof pdf?.URL === "string" ? pdf.URL : "";
        const count = data['is-referenced-by-count'];
        const citationCount = typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : undefined;
        return {
            title,
            author,
            journal,
            venue: journal,
            shortContainerTitle,
            containerTitle,
            pubDate,
            year,
            url,
            doi,
            doiUrl,
            pdfUrl,
            citationCount,
            citation: citationCount === undefined ? undefined : {
                count: citationCount, source: "crossref",
            },
        }
    }
}

export default CrossrefInfo;
