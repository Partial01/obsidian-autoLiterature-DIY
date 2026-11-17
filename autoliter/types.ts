type Dict = { [key: string]: any };

type CitationSource = "crossref" | "semantic_scholar";

interface CitationSnapshot {
	count: number;
	source: CitationSource;
}

interface SemanticScholarAuthor {
	name?: string;
}

interface SemanticScholarInfo {
	paperId?: string;
	externalIds?: { DOI?: string; ArXiv?: string };
	title?: string;
	year?: number;
	venue?: string;
	url?: string;
	citationCount?: number;
	openAccessPdf?: {
		url?: string;
	};
	authors?: SemanticScholarAuthor[];
}

interface SemanticScholarOptions {
	enabled: boolean;
	apiKey?: string;
}

interface PaperInfo extends Dict {
	id?: string;
	idType?: string;
	title?: string;
	author?: string;
	journal?: string;
	pubDate?: string;
	year?: string | number;
	url?: string;
	doi?: string;
	doiUrl?: string;
	arxivId?: string;
	arxivUrl?: string;
	pdfUrl?: string;
	localPdfPath?: string;
	venue?: string;
	shortContainerTitle?: string;
	containerTitle?: string;
	citationCount?: number;
	s2Url?: string;
	citation?: CitationSnapshot;
	semanticScholar?: SemanticScholarInfo;
	error?: string;
}

export type {
	CitationSnapshot,
	CitationSource,
	Dict,
	PaperInfo,
	SemanticScholarInfo,
	SemanticScholarOptions,
};
