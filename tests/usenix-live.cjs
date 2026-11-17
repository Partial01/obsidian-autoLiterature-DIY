// Opt-in network check of the real plugin parser against official USENIX pages.
const assert = require("node:assert/strict");
const load = require("./load-plugin.cjs")({
	requestUrl: async (options) => {
		const response = await fetch(options.url, { signal: AbortSignal.timeout(20000) });
		return { status: response.status, text: await response.text() };
	},
	Notice: class {},
});
const { getPaperEntries, buildReplaceDict } = load("autoliter/utils");

async function main() {
	for (const [slug, title, year] of [
		["usenixsecurity25/presentation/yu-zheng", "PATCHAGENT: A Practical Program Repair Agent Mimicking Human Expertise", "2025"],
		["usenixsecurity25/presentation/li-ying", "SoK: Towards Effective Automated Vulnerability Repair", "2025"],
		["usenixsecurity24/presentation/xing-yunlong", "What IF Is Not Enough? Fixing Null Pointer Dereference With Contextual Check", "2024"],
	]) {
		const input = `- {https://www.usenix.org/conference/${slug}}`;
		const entries = await getPaperEntries([...input.matchAll(/- \{[^{}\r\n]+\}/g)]);
		assert.equal(entries[0].error, undefined);
		const info = entries[0].info;
		assert.equal(info.title, title);
		assert.equal(info.year, year);
		assert.ok(info.author);
		assert.match(info.pdfUrl, /^https:\/\/www.usenix.org\/system\/files\/.+\.pdf$/);
		const [replacements] = buildReplaceDict(entries, "- **${title}**. *${author}*${venueYear}${linksText}${citationText}");
		assert.notEqual(replacements[input], input);
		assert.doesNotMatch(replacements[input], /<!-- autoliter:/);
		console.log(JSON.stringify({ source: slug, title: info.title, year: info.year, passed: true }));
	}
}

main().catch(() => { console.error("USENIX live verification failed. Check connectivity and provider availability."); process.exitCode = 1; });
