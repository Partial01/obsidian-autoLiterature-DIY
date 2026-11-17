// Execute the real TypeScript modules in Node; only the unavailable Obsidian host is replaced.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

module.exports = function loadPlugin(obsidian) {
	const cache = new Map();
	function load(filename) {
		if (cache.has(filename)) return cache.get(filename).exports;
		const module = { exports: {} };
		cache.set(filename, module);
		const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
			fileName: filename,
		}).outputText;
		const localRequire = (name) => {
			if (name === "obsidian") return obsidian;
			if (name.startsWith(".") || name.startsWith("autoliter/")) {
				return load(path.resolve(name.startsWith(".") ? path.dirname(filename) : root, `${name}.ts`));
			}
			return require(name);
		};
		vm.runInThisContext(`(function(require, module, exports) {${source}\n})`, { filename })(localRequire, module, module.exports);
		return module.exports;
	}
	return (name) => load(path.join(root, `${name}.ts`));
};
