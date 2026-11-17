// Check the actual Git-publishable file set; report locations, never matched values.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const failures = [];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const textFiles = files.filter((file) => /\.(?:md|ts|cjs|mjs|json|ya?ml|txt)$/.test(file) || [".npmrc", ".gitignore"].includes(file));
const contents = new Map();
const report = (file, category, text, index = 0) => failures.push({ file, category, line: text.slice(0, index).split("\n").length });
const rules = [
	["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
	["service-token", /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g],
	["literal-credential", /\b(?:api[_-]?key|apiKey|password|access[_-]?token|auth[_-]?token|secret)\b\s*[:=]\s*["']([^"'\r\n]+)["']/gi],
	["local-user-path", /(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\s"'`]+|\/(?:Users|home)\/[^\s"'`]+)/g],
	["workspace-path", /[A-Za-z]:[\\/](?:Obsidian[_]Storage)[\\/][^\s"'`]+/g],
	["private-handoff-reference", new RegExp(["context", "tmp", "ONLY"].join("_") + "|change-summary-" + "handoff", "g")],
];

for (const file of files) {
	if (file.split("/").includes("Offline" + "_Context")) report(file, "ignored-folder-is-publishable", "");
}
for (const file of textFiles) {
	const full = path.join(root, file);
	if (!fs.existsSync(full)) continue;
	const text = fs.readFileSync(full, "utf8");
	contents.set(file, text);
	for (const [category, regex] of rules) {
		for (const match of text.matchAll(regex)) report(file, category, text, match.index);
	}
	for (const match of text.matchAll(/https?:\/\/[^\s/"'`]+:[^\s/@"'`]+@/g)) {
		if (!match[0].includes("${")) report(file, "url-credentials", text, match.index);
	}
	for (const match of text.matchAll(/[?&](?:api[_-]?key|token|access_key|access_token|password)=([^\s&#"'`]+)/gi)) {
		if (!match[1].startsWith("${")) report(file, "credential-query-value", text, match.index);
	}
	if ((file.startsWith("autoliter/") || file === "main.ts") && /console\.(?:log|warn|error)\s*\(/.test(text)) report(file, "raw-runtime-console", text);
	if (file.endsWith(".zh-CN.md") && !files.includes(file.replace(/\.zh-CN\.md$/, ".md"))) report(file, "missing-english-counterpart", text);
	if (file.endsWith(".md") && !file.endsWith(".zh-CN.md")) {
		const withoutLanguageLink = text.replace(/^.*\[简体中文\].*$/gm, "");
		if (/[\u3400-\u9fff]/.test(withoutLanguageLink)) report(file, "non-english-primary-document", text);
	}
}

for (const [file, text] of contents) {
	if (!file.endsWith(".md")) continue;
	// Example syntax inside code is not a document navigation link.
	const prose = text.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1|`[^`\r\n]*`/g, (match) => " ".repeat(match.length));
	for (const match of prose.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
		const target = match[1];
		if (/^(?:https?:|mailto:|#)/.test(target) || target.includes("${")) continue;
		const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target.split("#")[0]));
		const relative = path.relative(root, resolved).split(path.sep).join("/");
		if (!files.includes(relative) || !fs.existsSync(resolved)) report(file, "unpublishable-document-link", text, match.index);
	}
}

const normalize = (value) => value.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
const en = contents.get("README.md") || "";
const zh = contents.get("README.zh-CN.md") || "";
const fences = (text) => [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => normalize(match[1]));
if (JSON.stringify(fences(en)) !== JSON.stringify(fences(zh))) report("README.zh-CN.md", "readme-example-mismatch", zh);
const main = contents.get("main.ts") || "";
const regexSetting = main.match(/\bregExp:\s*("(?:\\.|[^"\\])*")/);
const formatSetting = main.match(/\boutputFormat:\s*("(?:\\.|[^"\\])*")/);
for (const [file, text] of [["README.md", en], ["README.zh-CN.md", zh]]) {
	const documented = text.match(/^- (?:Default:|默认值：)[ \t]*`([^`]+)`/m);
	if (!regexSetting || !documented || JSON.parse(regexSetting[1]) !== documented[1]) report(file, "default-regex-mismatch", text);
	if (!formatSetting || !fences(text).includes(normalize(JSON.parse(formatSetting[1])))) report(file, "default-format-mismatch", text);
}
for (const [file, translated] of contents) {
	if (!file.endsWith(".zh-CN.md")) continue;
	const original = contents.get(file.replace(/\.zh-CN\.md$/, ".md"));
	if (!original) continue;
	if (JSON.stringify(fences(original)) !== JSON.stringify(fences(translated))) report(file, "translated-example-mismatch", translated);
	const tokens = (text) => [...new Set([...text.matchAll(/`([^`\r\n]+)`/g)].map((match) => match[1]))].sort();
	if (JSON.stringify(tokens(original)) !== JSON.stringify(tokens(translated))) report(file, "translated-reference-token-mismatch", translated);
}
for (const [file, text] of contents) {
	if (!file.endsWith(".md")) continue;
	for (const match of text.matchAll(/npm run ([\w:-]+)/g)) {
		if (!(match[1] in JSON.parse(contents.get("package.json")).scripts)) report(file, "unknown-npm-script", text, match.index);
	}
}

if (failures.length) {
	for (const failure of failures) console.error(JSON.stringify(failure));
	process.exitCode = 1;
} else {
	console.log(JSON.stringify({ result: "passed", textFiles: contents.size, checks: ["sensitive-text-patterns", "english-documents", "published-links", "translated-examples-and-tokens", "runtime-defaults", "npm-commands"] }));
}
