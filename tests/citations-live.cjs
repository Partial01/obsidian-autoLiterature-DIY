// Opt-in read-only check of DOI encoding, tracking and citation refresh against Crossref.
const assert = require("node:assert/strict");
const load = require("./load-plugin.cjs")({
	requestUrl: async (options) => {
		const response = await fetch(options.url, { signal: AbortSignal.timeout(20000) });
		const text = await response.text();
		return { status: response.status, text, get json() { return JSON.parse(text); } };
	},
	Notice: class {},
});
const { getPaperEntries, buildReplaceDict } = load("autoliter/utils");
const { updateCitations } = load("autoliter/citations");

async function main() {
	const input = "- {10.1038/s41586-021-03819-2}";
	const entries = await getPaperEntries([...input.matchAll(/- \{[^{}\r\n]+\}/g)]);
	assert.equal(entries[0].error, undefined);
	const [replacements] = buildReplaceDict(entries, "- **${title}**.${citationText}");
	const entry = replacements[input];
	assert.match(entry, /Highly accurate protein structure prediction with AlphaFold/);
	assert.match(entry, /\[Citations \d+\]\(https:\/\/api.crossref.org\/works\//);
	assert.doesNotMatch(entry, /<!--/);
	const result = await updateCitations(entry, { semantic: { enabled: false }, refreshCounts: true });
	assert.equal(result.updated, 1);
	assert.equal(result.failed, 0);
	assert.equal(result.content.replace(/\[Citations \d+\]/, ""), entry.replace(/\[Citations \d+\]/, ""));
	console.log(JSON.stringify({ doi: entries[0].info.doi, count: entries[0].info.citationCount, refreshed: result.updated, source: "crossref" }));
}

main().catch(() => { console.error("Crossref live verification failed. Check connectivity and provider availability."); process.exitCode = 1; });
