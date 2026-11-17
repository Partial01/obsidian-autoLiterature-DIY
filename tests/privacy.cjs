const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let request;
const notices = [];
const load = require("./load-plugin.cjs")({
	requestUrl: (...args) => request(...args),
	Notice: class { constructor(message) { notices.push(message); } },
});
const { errorMessage, PublicError } = load("autoliter/spiders/response");
const Crossref = load("autoliter/spiders/crossrefInfo").default;
const Usenix = load("autoliter/spiders/usenixInfo").default;
const Arxiv = load("autoliter/spiders/arxivInfo").default;
const Bio = load("autoliter/spiders/bmInfo").default;
const Spider = load("autoliter/spiders/spider").default;
const SemanticScholar = load("autoliter/spiders/semanticScholarInfo").default;
const { downloadPdf } = load("autoliter/pdfManager");
const { targetFromUrl, citationText, citationUrl } = load("autoliter/citationLinks");
const credential = "fixture-" + "private-value";
const requestUrl = `https://reader:${credential}@example.org/paper.pdf?access_key=${credential}#${credential}`;
const localPath = ["C:", "Users", "fixture-reader", "private-note.md"].join(String.fromCharCode(92));

function checkClean(text) {
	assert.ok(!text.includes(credential));
	assert.ok(!text.includes(localPath));
}

test("unknown exceptions and JSON parse errors never expose raw messages", () => {
	checkClean(errorMessage(new Error(`${requestUrl} ${localPath}`)));
	checkClean(errorMessage(new SyntaxError(credential)));
	assert.equal(errorMessage(Object.assign(new Error(credential), { status: 429 })), "HTTP 429");
	assert.equal(errorMessage(new PublicError("Crossref HTTP 404: No record")), "Crossref HTTP 404: No record");
});

test("provider failures keep useful categories without exposing request data", async () => {
	request = async () => { throw new Error(`${requestUrl} ${localPath}`); };
	for (const call of [
		() => new Crossref().getInfoByDoi("10.1145/example"),
		() => new Usenix().getInfo("https://www.usenix.org/conference/example/presentation/paper"),
		() => new Arxiv().getInfoByArxivId("1706.03762"),
		() => new Bio().getInfoByBMId("10.1101/example"),
		() => new Spider().getPaperInfo(requestUrl),
	]) {
		await assert.rejects(call(), (error) => { checkClean(error.message); return true; });
	}
	notices.forEach(checkClean);
});

test("PDF failure notices are sanitized while the actual authenticated request stays unchanged", async () => {
	let sent;
	request = async (args) => { sent = args.url; throw new Error(`${requestUrl} ${localPath}`); };
	const app = { vault: { createFolder: async () => {} } };
	const result = await downloadPdf(app, requestUrl, { title: "Paper" }, "title", "", "vault", "pdfs");
	assert.equal(result, null);
	assert.equal(sent, requestUrl);
	checkClean(notices[notices.length - 1]);
});

test("citation links reject URL credentials and transport parameters without exposing settings or arbitrary URLs", () => {
	assert.equal(targetFromUrl(requestUrl), null);
	assert.equal(targetFromUrl("https://api.crossref.org/works/10.1145%2Fexample?key=" + credential), null);
	const text = citationText({ s2Url: requestUrl, citationCount: 7, semanticScholar: { paperId: "a".repeat(40) }, semanticScholarApiKey: credential });
	checkClean(text);
	assert.doesNotMatch(text, /<!--|checked_at/);
	assert.match(citationUrl({ source: "crossref", doi: "10.12345/a?b#c" }), /10.12345%2Fa%3Fb%23c/);
});

test("S2 API keys stay in request headers and never enter the query URL or generated source link", async () => {
	request = async (args) => {
		assert.equal(args.headers["x-api-key"], credential);
		checkClean(args.url);
		return { json: { title: "Paper", paperId: "a".repeat(40), citationCount: 0 } };
	};
	const info = await new SemanticScholar().getInfo({ s2Id: "a".repeat(40), apiKey: credential });
	assert.equal(info.citationCount, 0);
	checkClean(citationText({ semanticScholar: info, citationCount: 0, citation: { count: 0, source: "semantic_scholar" } }));
});

async function runDiagnostic(readFileSync, fetch) {
	const output = [];
	const process = { argv: ["node", "diagnostic", localPath], exitCode: 0 };
	const source = fs.readFileSync(path.join(__dirname, "../scripts/diagnose-dois.cjs"), "utf8");
	await vm.runInNewContext(source, {
		require: () => ({ readFileSync }), process, fetch, AbortSignal,
		console: { log: (value) => output.push(value), error: (value) => output.push(value) },
	});
	return { output, process };
}

test("diagnostic output omits response bodies and raw network messages", async () => {
	let calls = 0;
	const { output } = await runDiagnostic(() => "- {10.1145/example}", async () => {
		if (++calls === 2) throw new Error(`${requestUrl} ${localPath}`);
		return { status: 404, body: { cancel: async () => {} }, text: () => { throw new Error("Response body must not be read"); } };
	});
	assert.equal(output.length, 4);
	output.forEach(checkClean);
	assert.equal(JSON.parse(output[1]).error, "network-error");
	assert.equal(JSON.parse(output[0]).preview, undefined);
});

test("diagnostic file errors never echo the input note path", async () => {
	const { output, process } = await runDiagnostic(() => { throw new Error(localPath); }, () => { throw new Error("must not query"); });
	assert.equal(process.exitCode, 1);
	assert.equal(output.length, 1);
	output.forEach(checkClean);
});
