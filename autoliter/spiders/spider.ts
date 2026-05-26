import { Notice } from "obsidian";
import ArxivInfo from "./arxivInfo";
import CrossrefInfo from "./crossrefInfo";
import BMInfo from "./bmInfo";
import SemanticScholarClient from "./semanticScholarInfo";
import type { PaperInfo, SemanticScholarInfo, SemanticScholarOptions } from "autoliter/types";

class Spider {
	arxivInfo: ArxivInfo;
	crossrefInfo: CrossrefInfo;
	bmInfo: BMInfo;
	semanticScholar: SemanticScholarClient;

	constructor() {
		this.arxivInfo = new ArxivInfo();
		this.crossrefInfo = new CrossrefInfo();
		this.bmInfo = new BMInfo();
		this.semanticScholar = new SemanticScholarClient();
	}
	classify(identifier: string): string {
		/*    
        Classify the type of paper_id:
            arxivId - arxivId
            doi - digital object identifier
            medbiorxivId - medrxiv or biorxiv id
        */
		if (identifier.match(/10\.(?!1101)[0-9]{4,9}\/.+/)) {
			return "doi";
		} else if (identifier.match(/10\.1101\/.+/)) {
			return "medbiorxivId";
		} else if (
			identifier.match(
				/(arXiv:)?[0-9]{2}[0-1][0-9]\.[0-9]{3,}.*|.*\/[0-9]{2}[0-1][0-9]{4}/
			)
		) {
			return "arxivId";
		} else {
			return "unrecognized";
		}
	}

	async getPaperInfo(
		paperID: string,
		semanticOptions?: SemanticScholarOptions
	): Promise<PaperInfo> {
		/*
        paperID: the paper id like 2022.12345
        */
		const id_type = this.classify(paperID);
		try {
			let paperInfo: PaperInfo;
			switch (id_type) {
				case "arxivId":
					paperInfo = await this.arxivInfo.getInfoByArxivId(paperID);
					break;
				case "doi":
					paperInfo = await this.crossrefInfo.getInfoByDoi(paperID);
					break;
				case "medbiorxivId":
					paperInfo = await this.bmInfo.getInfoByBMId(paperID);
					break;
				default:
					throw new Error(`Unrecognized paperID: "${paperID}"`);
			}
			paperInfo.id = paperID;
			paperInfo.idType = id_type;
			return await this.enrichWithSemanticScholar(
				paperInfo,
				semanticOptions
			);
		} catch (error) {
			new Notice(`${error.message}`);
			throw new Error(`Error in getPaperInfo: ${error.message}`);
		}
	}

	private async enrichWithSemanticScholar(
		paperInfo: PaperInfo,
		semanticOptions?: SemanticScholarOptions
	): Promise<PaperInfo> {
		if (!semanticOptions?.enabled) {
			return paperInfo;
		}

		const semanticInfo = await this.semanticScholar.getInfo({
			doi: paperInfo.doi || (paperInfo.idType === "doi" ? paperInfo.id : ""),
			arxivId: paperInfo.arxivId || (paperInfo.idType === "arxivId" ? paperInfo.id : ""),
			title: paperInfo.title,
			apiKey: semanticOptions.apiKey,
		});

		if (!semanticInfo) {
			return paperInfo;
		}

		return this.mergeSemanticScholarInfo(paperInfo, semanticInfo);
	}

	private mergeSemanticScholarInfo(
		paperInfo: PaperInfo,
		semanticInfo: SemanticScholarInfo
	): PaperInfo {
		paperInfo.semanticScholar = semanticInfo;
		paperInfo.s2Url = semanticInfo.url || paperInfo.s2Url;
		paperInfo.citationCount =
			semanticInfo.citationCount ?? paperInfo.citationCount;
		paperInfo.venue = paperInfo.venue || semanticInfo.venue;
		paperInfo.year = paperInfo.year || semanticInfo.year;
		paperInfo.pdfUrl =
			paperInfo.pdfUrl ||
			semanticInfo.openAccessPdf?.url ||
			"";
		if (!paperInfo.author && semanticInfo.authors?.length) {
			paperInfo.author = semanticInfo.authors
				.map((author) => author.name)
				.filter(Boolean)
				.join(" and ");
		}
		return paperInfo;
	}
}

export default Spider;
