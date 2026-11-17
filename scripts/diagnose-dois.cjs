// Read-only probes. Node 18+; no API key, note writes or PDF downloads.
const fs = require("node:fs");

async function main() {
	const note = process.argv[2];
	if (!note) throw new Error("Usage: node scripts/diagnose-dois.cjs <note.md>");
	const content = fs.readFileSync(note, "utf8");
	const ids = [...new Set([...content.matchAll(/\{\s*(10\.\d{4,9}\/[^{}\s]+)\s*\}/g)].map((match) => match[1]))];
	for (const id of ids) {
		const encoded = encodeURIComponent(id);
		for (const [provider, url, accept] of [
			["crossref", `https://api.crossref.org/works/${encoded}`, "application/json"],
			["doi-csl", `https://doi.org/${encoded}`, "application/vnd.citationstyles.csl+json"],
			["acm", `https://dl.acm.org/doi/${id}`, "text/html"],
			["semantic-scholar", `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(`DOI:${id}`)}?fields=title,year,citationCount`, "application/json"],
		]) {
			try {
				const response = await fetch(url, { headers: { Accept: accept }, signal: AbortSignal.timeout(20000) });
				await response.body?.cancel();
				console.log(JSON.stringify({ provider, id, status: response.status }));
			} catch (error) {
				console.log(JSON.stringify({ provider, id, error: error?.name === "TimeoutError" ? "timeout" : "network-error" }));
			}
		}
	}
}

main().catch(() => { console.error("Cannot read or diagnose the note. Usage: node scripts/diagnose-dois.cjs <note.md>"); process.exitCode = 1; });
