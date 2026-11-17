const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
let request;
const load = require("./load-plugin.cjs")({
	requestUrl: (...args) => request(...args),
	Notice: class {},
});
const Crossref = load("autoliter/spiders/crossrefInfo").default;
const Usenix = load("autoliter/spiders/usenixInfo").default;
const Spider = load("autoliter/spiders/spider").default;
const S2 = load("autoliter/spiders/semanticScholarInfo").default;
const { getPaperEntries, buildReplaceDict } = load("autoliter/utils");
const { withTimeout } = load("autoliter/spiders/response");
const source = "https://www.usenix.org/conference/usenixsecurity25/presentation/yu-zheng";
const html = `<meta name="citation_title" content="{PATCHAGENT}: A Practical Program Repair Agent Mimicking Human Expertise">
<meta content='Zheng Yu' name='citation_author'><meta name="citation_author" content="Ziyi Guo">
<meta name="citation_publication_date" content="2025/08/13">
<meta name="citation_conference_title" content="34th USENIX Security Symposium (USENIX Security 25)">
<meta name="citation_pdf_url" content="/system/files/usenixsecurity25-yu-zheng.pdf">`;

beforeEach(() => { request = async () => { throw new Error("Unexpected network request"); }; });

test("all three failing catalog IDs report Crossref 404 with an actionable explanation", async () => {
	request = async () => ({ status: 404 });
	for (const id of ["3766078.3766304", "3766078.3766307", "3698900.3698977"]) {
		await assert.rejects(new Crossref().getInfoByDoi(`10.5555/${id}`), /HTTP 404.*test\/unmaintained.*USENIX/);
	}
});

test("Crossref distinguishes rate limit, network and malformed metadata", async () => {
	request = async () => ({ status: 429 });
	await assert.rejects(new Crossref().getInfoByDoi("10.1145/example"), /HTTP 429.*Rate limited/);
	request = async () => { throw new Error("offline"); };
	await assert.rejects(new Crossref().getInfoByDoi("10.1145/example"), /request failed: Request failed/);
	request = async () => ({ status: 200, json: { message: { title: [] } } });
	await assert.rejects(new Crossref().getInfoByDoi("10.1145/example"), /metadata error: Missing title/);
	request = async () => ({ status: 200, get json() { throw new SyntaxError("invalid JSON"); } });
	await assert.rejects(new Crossref().getInfoByDoi("10.1145/example"), /metadata error: Invalid JSON response/);
});

test("DOI is trimmed and encoded, optional metadata falls back without treating HTML as a PDF", async () => {
	request = async (options) => {
		assert.equal(options.url, "https://api.crossref.org/works/10.12345%2Fa%3Fb%23c");
		return { status: 200, json: { message: { title: ["Paper"], DOI: "10.12345/a?b#c", issued: { "date-parts": [[2025]] }, link: [{ "content-type": "text/html", URL: "https://example.org" }], "is-referenced-by-count": 0 } } };
	};
	const info = await new Crossref().getInfoByDoi(" 10.12345/a?b#c ");
	assert.equal(info.year, "2025");
	assert.equal(info.citationCount, 0);
	assert.equal(info.pdfUrl, "");
	assert.equal(info.url, "https://doi.org/10.12345/a?b#c");
});

test("invalid citation values are omitted rather than displayed as zero", () => {
	for (const count of [null, true, "5", -1, 1.5, Infinity]) {
		assert.equal(new Crossref().extractInfo({ title: ["Paper"], "is-referenced-by-count": count }).citationCount, undefined);
	}
});

test("USENIX without a DOI works through placeholder recognition, fetch and Markdown formatting", async () => {
	request = async (options) => {
		assert.equal(options.url, source);
		return { status: 200, text: html };
	};
	const entries = await getPaperEntries([...`- { ${source} }`.matchAll(/- \{[^{}\r\n]+\}/g)]);
	const [replacements] = buildReplaceDict(entries, "- **${title}**.${venueYear}${linksText}${citationText}");
	const result = Object.values(replacements)[0];
	assert.match(result, /^- \*\*PATCHAGENT:/);
	assert.match(result, /USENIX Security 25\), 2025/);
	assert.match(result, /https:\/\/www.usenix.org\/system\/files\/usenixsecurity25-yu-zheng.pdf/);
	assert.doesNotMatch(result, /Citations/);
});

test("USENIX metadata decodes entities, quoted attributes and multiple authors", () => {
	const info = new Usenix().extractInfo(html.replace("{PATCHAGENT}", "A &amp; B &quot;quoted&quot; &#x3b1;"), source);
	assert.match(info.title, /^A & B "quoted" α/);
	assert.equal(info.author, "Zheng Yu and Ziyi Guo");
});

test("missing USENIX metadata fails and preserves the original placeholder", async () => {
	request = async () => ({ status: 200, text: "<title>Access denied</title>" });
	const origin = `- {${source}}`;
	const entries = await getPaperEntries([...origin.matchAll(/- \{[^{}\r\n]+\}/g)]);
	const [replacements] = buildReplaceDict(entries, "${title}");
	assert.equal(replacements[origin], origin);
});

test("source classification accepts official URLs and DOI prefixes without accepting lookalike hosts", () => {
	const spider = new Spider();
	assert.equal(spider.classify(source), "usenix");
	assert.equal(spider.classify("10.123456789/example"), "doi");
	assert.equal(spider.classify("10.11012/example"), "doi");
	assert.equal(spider.classify("10.1101/example"), "medbiorxivId");
	for (const url of [source.replace("usenix.org", "usenix.org.example.com"), source.replace("https:", "http:")]) {
		assert.equal(spider.classify(url), "unrecognized");
	}
});

test("USENIX exact-title enhancement accepts braces, rejects ambiguous results and keeps base metadata on failure", async () => {
	let calls = 0;
	request = async () => {
		calls++;
		return calls === 1 ? { status: 200, text: html } : { json: { data: [
			{ title: "{PATCHAGENT}: A Practical Program Repair Agent Mimicking Human Expertise", citationCount: 7 },
		] } };
	};
	const info = await new Spider().getPaperInfo(source, { enabled: true });
	assert.equal(info.citationCount, 7);
	const client = new S2();
	// Exercise the actual selection boundary directly to avoid provider timing in this check.
	assert.equal(client.selectExactTitleMatch({ data: [{ title: "Paper" }, { title: "{Paper}" }] }, "Paper"), null);
	calls = 0;
	request = async () => {
		if (++calls === 1) return { status: 200, text: html };
		throw new Error("rate limited");
	};
	const base = await new Spider().getPaperInfo(source, { enabled: true });
	assert.match(base.title, /^PATCHAGENT:/);
	assert.equal(base.citationCount, undefined);
	request = async () => { throw new Error("offline"); };
	assert.equal(await client.getInfo({ title: "Paper" }), null);
});

test("request timeout returns without waiting indefinitely", async () => {
	await assert.rejects(withTimeout(new Promise(() => {}), "Crossref", 5), /Crossref timed out/);
});
