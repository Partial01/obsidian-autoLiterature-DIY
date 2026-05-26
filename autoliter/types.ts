type Dict = { [key: string]: any };

interface SemanticScholarAuthor {
	name?: string;
}

interface SemanticScholarInfo {
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
	semanticScholar?: SemanticScholarInfo;
	error?: string;
}

export type {
	Dict,
	PaperInfo,
	SemanticScholarInfo,
	SemanticScholarOptions,
};
