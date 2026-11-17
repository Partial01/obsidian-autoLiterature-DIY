const assert = require("node:assert/strict");
const { test } = require("node:test");
let request;
const notices = [];
class HostPlugin {
	async loadData() { return this.saved || {}; }
	async saveData(data) { this.saved = data; }
	addSettingTab() {}
	addRibbonIcon(icon, name, callback) { this.ribbon = callback; }
	addCommand(command) { (this.commands ||= []).push(command); }
}
const load = require("./load-plugin.cjs")({
	requestUrl: (...args) => request(...args),
	Notice: class { constructor(message) { notices.push(message); } },
	Plugin: HostPlugin,
	PluginSettingTab: class {},
});
const AutoLiter = load("main").default;
const Pattern = load("autoliter/patternRecognizer").default;
const tracked = "- **Original**. *Author* ([Citations 1](https://api.crossref.org/works/10.1145%2Fexample))";

async function fixture(settings = {}) {
	const plugin = new AutoLiter();
	plugin.saved = settings;
	const file = { path: "note.md" };
	const state = { content: tracked, writes: 0, downloads: 0 };
	plugin.app = {
		workspace: { getActiveFile: () => file },
		vault: {
			read: async () => state.content,
			process: async (_, callback) => { const next = callback(state.content); if (next !== state.content) state.writes++; state.content = next; },
			getMarkdownFiles: () => [file],
			createBinary: async () => { state.downloads++; },
		},
	};
	await plugin.onload();
	return { plugin, state, file };
}

test("refresh is off by default and the ribbon leaves existing tracked entries untouched", async () => {
	const { plugin, state } = await fixture();
	assert.equal(plugin.settings.refreshCitationCounts, false);
	request = async () => { throw new Error("must not request with refresh off"); };
	await plugin.ribbon();
	assert.equal(state.content, tracked);
	assert.equal(state.writes, 0);
});

test("one ribbon click refreshes existing entries and converts new placeholders, without a PDF request for refresh", async () => {
	const { plugin, state } = await fixture({ refreshCitationCounts: true });
	state.content += "\n- {10.1145/new}\n\t- 手写笔记\n";
	let calls = 0;
	request = async (args) => {
		calls++;
		assert.match(args.url, /^https:\/\/api.crossref.org\/works\//);
		return { status: 200, json: { message: { DOI: args.url.includes("new") ? "10.1145/new" : "10.1145/example", title: ["New paper"], "is-referenced-by-count": 9 } } };
	};
	await plugin.ribbon();
	assert.equal(calls, 2);
	assert.match(state.content, /^- \*\*Original\*\*/);
	assert.match(state.content, /\*\*New paper\*\*/);
	assert.match(state.content, /\[Citations 9\]/);
	assert.match(state.content, /手写笔记/);
	assert.equal(state.downloads, 0);
});

test("whole-vault and selected-text commands share the refresh switch", async () => {
	const { plugin, state } = await fixture({ refreshCitationCounts: true });
	request = async () => ({ status: 200, json: { message: { title: ["Provider title"], "is-referenced-by-count": 3 } } });
	await plugin.commands.find((command) => command.id === "update-vault").editorCallback({});
	assert.match(state.content, /\[Citations 3\]/);
	assert.match(await plugin.updateSelected(tracked, plugin.paperRecognizer), /\[Citations 3\]/);
});

test("refresh enabled still leaves untracked legacy entries untouched", async () => {
	const { plugin, state } = await fixture({ refreshCitationCounts: true });
	const legacy = "- **Legacy**. ([S2](https://www.semanticscholar.org/paper/" + "a".repeat(40) + ")) (Citations 1)";
	state.content = legacy;
	let calls = 0;
	request = async () => { calls++; throw new Error("must not query legacy entries"); };
	await plugin.ribbon();
	assert.equal(calls, 0);
	assert.equal(state.content, legacy);
});

test("selected-text command does not replace a selection moved while the query is pending", async () => {
	const { plugin } = await fixture({ refreshCitationCounts: true });
	let resolveRequest;
	request = () => new Promise((resolve) => { resolveRequest = resolve; });
	let moved = false;
	let writes = 0;
	const editor = {
		getSelection: () => tracked,
		getCursor: (end) => ({ line: moved ? 2 : 0, ch: end === "from" ? 0 : tracked.length }),
		replaceSelection: () => { writes++; },
	};
	const pending = plugin.commands.find((command) => command.id === "update-selected").editorCallback(editor);
	await new Promise((resolve) => setImmediate(resolve));
	moved = true;
	resolveRequest({ status: 200, json: { message: { title: ["Provider title"], "is-referenced-by-count": 2 } } });
	await pending;
	assert.equal(writes, 0);
});

test("a note edited while querying is preserved and concurrent updates to the same note are ignored", async () => {
	const { plugin, state, file } = await fixture({ refreshCitationCounts: true });
	let resolveRequest;
	request = () => new Promise((resolve) => { resolveRequest = resolve; });
	const pending = plugin.updateFile(file, plugin.paperRecognizer);
	await new Promise((resolve) => setImmediate(resolve));
	await plugin.updateFile(file, plugin.paperRecognizer);
	const edited = tracked + "\nnew handwritten text";
	state.content = edited;
	resolveRequest({ status: 200, json: { message: { title: ["Provider title"], "is-referenced-by-count": 10 } } });
	await pending;
	assert.equal(state.content, edited);
	assert.equal(state.writes, 0);
	assert.ok(notices.some((message) => message.includes("Note changed")));
});

test("multiple and repeated placeholders on one line use separate matches and a cached lookup", async () => {
	const { plugin } = await fixture();
	let calls = 0;
	request = async () => { calls++; return { status: 200, json: { message: { title: ["Paper"], DOI: "10.1145/example" } } }; };
	const result = await plugin.updateSelected("- {10.1145/example} - {10.1145/example}", plugin.paperRecognizer);
	assert.equal(calls, 1);
	assert.equal((result.match(/\*\*Paper\*\*/g) || []).length, 2);
	assert.equal((result.match(/\[Citations\]/g) || []).length, 2);
	assert.doesNotMatch(result, /<!--/);
});

test("the original button migrates old comments even when count refresh is disabled", async () => {
	const { plugin, state } = await fixture();
	state.content = '- **Original**. (Citations 1) <!-- autoliter: {"v":1,"id":"10.1145/example","doi":"10.1145/example","citation_count":1,"citation_source":"crossref","citation_checked_at":"2025-01-01T00:00:00Z"} -->';
	request = async () => { throw new Error("migration must not query"); };
	await plugin.ribbon();
	assert.match(state.content, /\[Citations 1\]/);
	assert.doesNotMatch(state.content, /<!--/);
});

test("legacy default regex migrates without replacing custom patterns and empty custom patterns do not loop forever", async () => {
	const { plugin } = await fixture({ regExp: "- {.{3,}}" });
	assert.equal(plugin.paperRecognizer.findAll("- {10.1/a} - {10.2/b}").length, 2);
	const { plugin: custom } = await fixture({ regExp: "CUSTOM" });
	assert.equal(custom.settings.regExp, "CUSTOM");
	assert.equal(new Pattern("").findAll("abc").length, 4);
});
