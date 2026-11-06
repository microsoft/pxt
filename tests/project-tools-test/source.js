"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

function source(file) {
    return ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
        fileName: file,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2018,
            jsx: ts.JsxEmit.React
        }
    }).outputText;
}

function bundleSource(entries, globalName, externals = { react: "window.React", "react-dom": "window.ReactDOM" }) {
    const modules = new Map();
    const visit = file => {
        if (modules.has(file)) return;
        const code = source(file);
        const imports = {};
        modules.set(file, { code, imports });
        for (const [, id] of code.matchAll(/require\("([^"]+)"\)/g)) {
            if (!id.startsWith(".")) {
                assert.ok(externals[id], `Unexpected source import ${id}`);
                continue;
            }
            const base = path.posix.join(path.posix.dirname(file), id);
            if (externals[base]) {
                imports[id] = base;
                continue;
            }
            const dependency = [".ts", ".tsx", "/index.ts", "/index.tsx"]
                .map(extension => base + extension).find(candidate => fs.existsSync(path.join(root, candidate)));
            assert.ok(dependency, `Cannot resolve ${id} from ${file}`);
            imports[id] = dependency;
            visit(dependency);
        }
    };
    entries.forEach(visit);
    return `(function() {
        const modules = {${Array.from(modules, ([file, { code, imports }]) =>
            `${JSON.stringify(file)}: [function(require, exports, module) {\n${code}\n}, ${JSON.stringify(imports)}]`).join(",\n")}};
        const cache = {${Object.entries(externals).map(([id, value]) => `${JSON.stringify(id)}: { exports: ${value} }`).join(",")}};
        function load(id) {
            if (cache[id]) return cache[id].exports;
            const [factory, imports] = modules[id];
            const module = cache[id] = { exports: {} };
            factory(name => load(imports[name] || name), module.exports, module);
            return module.exports;
        }
        window[${JSON.stringify(globalName)}] = Object.assign({}, ...${JSON.stringify(entries)}.map(load));
    })();`;
}

module.exports = { source, bundleSource };
