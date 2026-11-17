const assert = require("node:assert/strict");
const { test } = require("node:test");
let request;
const load = require("./load-plugin.cjs")({ requestUrl: (...args) => request(...args), Notice: class {} });
const { updateCitations, createCitationLookup } = load("autoliter/citations");
const { citationLink, citationUrl, targetFromUrl } = load("autoliter/citationLinks");
const { formatPaperInfo } = load("autoliter/utils");
const crossref = { source: "crossref", doi: "10.1145/example" };
const s2 = { source: "semantic_scholar", key: { kind: "paper", id: "a".repeat(40) } };
const options = { semantic: { enabled: true }, refreshCounts: true };
const line = (target = crossref, count = 7) => `- **Paper**. *Author* Venue, 2025 ([PDF](pdfs/paper.pdf)) (${citationLink(target, count)}) user text`;
const success = async (target) => ({ count: 0, target });
const comment = (overrides = {}) => `<!-- autoliter: ${JSON.stringify({
	v: 1, id: crossref.doi, doi: crossref.doi, citation_format: "inline", citation_count: 7,
	citation_source: "crossref", citation_checked_at: "2025-01-01T00:00:00Z", ...overrides,
})} -->`;
const legacy = (overrides) => `- **Paper**. *Author* (Citations 7) ${comment(overrides)} user text`;

test("new default output has a clickable count after paper links and no JSON comment", () => {
	const output = formatPaperInfo({ id: crossref.doi, idType: "doi", title: "Paper", pdfUrl: "pdfs/paper.pdf", citationCount: 7,
		citation: { count: 7, source: "crossref", checkedAt: "2025-01-01T00:00:00Z" },
	}, "- **${title}**.${linksText}${citationText}\r\n\t- notes");
	assert.match(output, /\(\[PDF\]\(pdfs\/paper.pdf\)\) \(\[Citations 7\]\(https:\/\/api.crossref.org\/works\/10.1145%2Fexample\)\)/);
	assert.doesNotMatch(output, /<!--|citation_checked_at|autoliter:/);
	assert.match(output, /\r\n\t- notes$/);
});

test("count provider is preserved even if a different provider's paper link is available", () => {
	const common = { id: crossref.doi, idType: "doi", title: "Paper", citationCount: 7, s2Url: citationUrl(s2), semanticScholar: { paperId: s2.key.id } };
	const fromCrossref = formatPaperInfo({ ...common, citation: { count: 7, source: "crossref", checkedAt: "2025-01-01T00:00:00Z" } }, "- **${title}**.${citationText}");
	const fromS2 = formatPaperInfo({ ...common, citation: { count: 7, source: "semantic_scholar", checkedAt: "2025-01-01T00:00:00Z" } }, "- **${title}**.${citationText}");
	assert.match(fromCrossref, /api.crossref.org/);
	assert.match(fromS2, /www.semanticscholar.org/);
});

test("pending links carry no invented zero and entries without an identifier carry no tracking markup", () => {
	const pending = formatPaperInfo({ id: crossref.doi, idType: "doi", title: "Paper" }, "- **${title}**.${citationText}");
	assert.match(pending, /\[Citations\]/);
	assert.doesNotMatch(pending, /Citations 0/);
	const unknown = formatPaperInfo({ id: "https://www.usenix.org/conference/example/presentation/paper", title: "Paper" }, "- **${title}**.${citationText}");
	assert.equal(unknown, "- **Paper**.");
});

test("refresh changes only the dedicated link and preserves text, images and CRLF", async () => {
	const input = `前言\r\n${line()}\r\n\t- 手写笔记 ![[image.png]]\r\n`;
	const result = await updateCitations(input, options, success);
	assert.equal(result.updated, 1);
	assert.equal(result.content.replace("[Citations 0]", "[Citations 7]"), input);
});

test("untracked legacy entries with ordinary S2, DOI and PDF links are never queried", async () => {
	const input = `- **Legacy**. ([S2](${citationUrl(s2)})) ([DOI](https://doi.org/${crossref.doi})) (Citations 10)\n`;
	let calls = 0;
	const result = await updateCitations(input, options, async () => { calls++; return null; });
	assert.equal(result.content, input);
	assert.equal(calls, 0);
});

test("failed and invalid lookups preserve the entire linked entry", async () => {
	const input = line();
	for (const lookup of [async () => null, async () => { throw new Error("HTTP 429"); },
		async () => ({ count: -1, target: crossref }), async () => ({ count: true, target: crossref }),
		async () => ({ count: "12", target: crossref }), async () => ({ count: 12, target: s2 }),
		async () => ({ count: 12, target: { source: "crossref", doi: "10.1145/another" } }),
	]) assert.equal((await updateCitations(input, options, lookup)).content, input);
});

test("S2 disabled and refresh disabled do not query dedicated links", async () => {
	let calls = 0;
	for (const settings of [{ semantic: { enabled: false }, refreshCounts: true }, { semantic: { enabled: true }, refreshCounts: false }]) {
		const result = await updateCitations(line(s2), settings, async () => { calls++; return null; });
		assert.equal(result.content, line(s2));
	}
	assert.equal(calls, 0);
});

test("duplicate source identities share a lookup; pending counts can acquire zero", async () => {
	let calls = 0;
	const input = `${line(crossref, undefined).replace("[Citations 7]", "[Citations]")}\n${line()}\n`;
	const result = await updateCitations(input, options, async (target) => { calls++; return success(target); });
	assert.equal(calls, 1);
	assert.equal(result.updated, 2);
	assert.equal((result.content.match(/\[Citations 0\]/g) || []).length, 2);
});

test("code fences, inline examples, indented code and multiline HTML comments are preserved", async () => {
	const input = `~~~md\n${line()}\n~~~\n    ${line()}\n- **Example**. \`(${citationLink(crossref, 7)})\`\n<!--\n${line()}\n-->\n- **Example**. \`${comment()}\`\n`;
	let calls = 0;
	const result = await updateCitations(input, options, async () => { calls++; return null; });
	assert.equal(result.content, input);
	assert.equal(calls, 0);
});

test("nested backticks and ordinary HTML comments do not opt inline examples into refresh", async () => {
	const input = `- **Example**. \`\`outer \`(${citationLink(crossref, 7)})\` inner\`\`\n- **Example**. <!-- (${citationLink(crossref, 7)}) -->\n`;
	let calls = 0;
	const result = await updateCitations(input, options, async () => { calls++; return null; });
	assert.equal(result.content, input);
	assert.equal(calls, 0);
});

test("multiple dedicated links and unsafe or malformed destinations are skipped without a request", async () => {
	const inputs = [line() + ` (${citationLink(s2, 7)})`,
		line().replace("api.crossref.org", "api.crossref.org.example.com"),
		line().replace("https:", "http:"), line().replace("[Citations 7]", "[Citations -1]"),
		line().replace("%2Fexample", "%2Fexample?key=placeholder"),
	];
	let calls = 0;
	for (const input of inputs) assert.equal((await updateCitations(input, options, async () => { calls++; return null; })).content, input);
	assert.equal(calls, 0);
});

test("escaped Markdown citation examples are not refreshed", async () => {
	const input = line().replace("[Citations", "\\[Citations");
	let calls = 0;
	const result = await updateCitations(input, options, async (target) => { calls++; return success(target); });
	assert.equal(result.content, input);
	assert.equal(calls, 0);
});

test("legacy comments migrate locally even with refresh disabled, preserving visible counts and handwritten text", async () => {
	const input = legacy();
	const result = await updateCitations(input, { semantic: { enabled: false }, refreshCounts: false }, async () => { throw new Error("must not query"); });
	assert.equal(result.content, `- **Paper**. *Author* (${citationLink(crossref, 7)}) user text`);
	assert.equal(result.migrated, 1);
	assert.equal(result.updated, 0);
});

test("migration keeps the saved S2 source, even with S2 disabled", async () => {
	const result = await updateCitations(legacy({ s2_id: s2.key.id, citation_source: "semantic_scholar" }), { semantic: { enabled: false }, refreshCounts: false });
	assert.match(result.content, /www.semanticscholar.org/);
	assert.doesNotMatch(result.content, /<!--/);
});

test("S2 migration retains its DOI query identity when no paper ID was saved", async () => {
	const result = await updateCitations(legacy({ citation_source: "semantic_scholar" }), { semantic: { enabled: false }, refreshCounts: false });
	assert.match(result.content, /api.semanticscholar.org\/graph\/v1\/paper\/DOI%3A10.1145%2Fexample/);
	assert.doesNotMatch(result.content, /api.crossref.org|<!--/);
});

test("migration without a previous count adds a pending link, not a zero", async () => {
	const marker = `<!-- autoliter: ${JSON.stringify({ v: 1, id: crossref.doi, doi: crossref.doi })} -->`;
	const result = await updateCitations(`- **Paper**. ${marker}`, { semantic: { enabled: false }, refreshCounts: false });
	assert.equal(result.content, `- **Paper**. (${citationLink(crossref)})`);
});

test("unresolved, invalid, extended, unsupported and conflicting comments are retained", async () => {
	const inputs = [legacy({ doi: undefined, id: "https://www.usenix.org/conference/example/presentation/paper" }),
		legacy({ v: 2 }), legacy({ custom_field: "keep" }), legacy({ citation_format: "unsupported" }),
		legacy() + " " + comment(), legacy() + ` (${citationLink(s2, 7)})`,
		legacy({ citation_count: undefined, citation_source: undefined, citation_checked_at: undefined }),
	];
	let calls = 0;
	for (const input of inputs) assert.equal((await updateCitations(input, options, async () => { calls++; return null; })).content, input);
	assert.equal(calls, 0);
});

test("a failed network refresh still completes safe local comment migration without changing the count", async () => {
	const result = await updateCitations(legacy(), options, async () => null);
	assert.equal(result.migrated, 1);
	assert.equal(result.failed, 1);
	assert.equal(result.content, `- **Paper**. *Author* (${citationLink(crossref, 7)}) user text`);
});

test("an existing matching citation link allows the redundant old comment to be removed", async () => {
	const input = `${line()} ${comment()}`;
	const result = await updateCitations(input, { semantic: { enabled: false }, refreshCounts: false });
	assert.equal(result.content, line());
});

test("DOI punctuation round-trips in Markdown-safe destinations without becoming URL credentials or queries", () => {
	const target = { source: "crossref", doi: "10.12345/a(b)?c#d" };
	const url = citationUrl(target);
	assert.doesNotMatch(url, /[()?#]/);
	assert.deepEqual(targetFromUrl(url), target);
});

test("Crossref refresh executes the real provider parser and never downloads PDFs or rewrites the title", async () => {
	let calls = 0;
	request = async (args) => { calls++; assert.match(args.url, /^https:\/\/api.crossref.org\/works\//); return { status: 200, json: { message: { title: ["Changed title"], "is-referenced-by-count": 12 } } }; };
	const result = await updateCitations(line(), { semantic: { enabled: false }, refreshCounts: true });
	assert.equal(calls, 1);
	assert.match(result.content, /^- \*\*Paper\*\*/);
	assert.match(result.content, /\[Citations 12\]/);
});

test("S2 paper links query only the saved ID and never fall back to title search", async () => {
	const requests = [];
	request = async (args) => { requests.push(args.url); throw new Error("HTTP 404"); };
	assert.equal(await createCitationLookup({ enabled: true })(s2), null);
	assert.equal(requests.length, 1);
	assert.match(requests[0], new RegExp(`/paper/${s2.key.id}\\?`));
});

test("a known S2 paper is not replaced by a different S2 result ID", async () => {
	const result = await updateCitations(line(s2), options, async () => ({ count: 5, target: { source: "semantic_scholar", key: { kind: "paper", id: "b".repeat(40) } } }));
	assert.equal(result.content, line(s2));
	assert.equal(result.failed, 1);
});

test("S2 DOI and arXiv lookup links upgrade to the canonical paper page after a successful query", async () => {
	for (const key of [{ kind: "doi", id: crossref.doi }, { kind: "arxiv", id: "1706.03762" }]) {
		const target = { source: "semantic_scholar", key };
		assert.deepEqual(targetFromUrl(citationUrl(target)), target);
		request = async () => ({ json: { title: "Paper", paperId: s2.key.id, citationCount: 0 } });
		const result = await updateCitations(line(target), options);
		assert.ok(result.content.includes(citationLink(s2, 0)));
	}
});

test("custom raw counts remain untracked, while citationText and explicit citationUrl layouts are refreshable", async () => {
	const info = { id: crossref.doi, idType: "doi", title: "Paper", citationCount: 7 };
	const raw = formatPaperInfo(info, "- **${title}**. count=${citationCount}");
	assert.equal((await updateCitations(raw, options, success)).content, raw);
	const linked = formatPaperInfo(info, "- **${title}**. ([Citations ${citationCount}](${citationUrl}))");
	assert.match((await updateCitations(linked, options, success)).content, /\[Citations 0\]/);
});
