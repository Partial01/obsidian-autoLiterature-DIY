import type { PaperInfo } from "autoliter/types";
import { requestUrl } from "obsidian";

// const HEADERS = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:27.0) Gecko/20100101 Firefox/43.0'};

class CrossrefInfo {
    private base_url: string;

    constructor() {
        this.base_url = "https://api.crossref.org/";
    }

    async getInfoByDoi(doi: string): Promise<PaperInfo> {
        const url = `${this.base_url}works/${doi}`;
        try {
            const response = await requestUrl(url);
            return this.extractInfo(response.json['message']);
        } catch (error) {
            throw new Error(`Error in getInfoByDoi: ${error.message}(request url: ${url})`);
        }
    }

    extractInfo(data: any): PaperInfo {
        const title: string = data['title'][0];
        const author: string = data['author'] && data['author'].length > 0
            ? data['author']
                .map((i: any) => `${i.given || ""} ${i.family || ""}`.trim())
                .filter(Boolean)
                .join(" and ")
            : "No author";
        const shortContainerTitle = data['short-container-title']?.[0];
        const containerTitle = data['container-title']?.[0];
        const journal = shortContainerTitle || containerTitle || "No journal";
        const dateParts = data['published']?.["date-parts"]?.[0] || [];
        const pubDate = dateParts.map((i: number) => String(i)).join('-');
        const year = dateParts[0] ? String(dateParts[0]) : "";
        const url: string = data['URL'];
        const doi: string = data['DOI'];
        const doiUrl = doi ? `https://doi.org/${doi}` : "";
        const pdfUrl = (data.link || []).find((link: any) =>
            String(link?.["content-type"] || "").includes("pdf")
        )?.URL || data.link?.[0]?.URL || "";
        const citationCount = data['is-referenced-by-count'];
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
        }
    }
}

export default CrossrefInfo;
