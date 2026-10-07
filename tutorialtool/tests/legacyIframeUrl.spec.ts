import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import * as ts from "typescript";

function loadLegacyWithLocale(hostUrl: string) {
    const source = fs.readFileSync(path.resolve("docs/static/tutorial-tool/tutorial.ts"), "utf8");
    const script = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.None }
    }).outputText;

    const element = {
        addEventListener: () => undefined,
        appendChild: () => undefined,
        className: "",
        focus: () => undefined,
        select: () => undefined,
        value: ""
    };
    const context: any = {
        URL,
        clearTimeout,
        console,
        document: {
            createElement: () => ({ contentWindow: { postMessage: () => undefined }, setAttribute: () => undefined }),
            getElementById: () => element
        },
        localStorage: { getItem: () => null, setItem: () => undefined },
        monaco: {
            editor: {
                create: () => ({
                    getValue: () => "",
                    onDidChangeModelContent: () => undefined
                })
            }
        },
        navigator: { language: "en" },
        setTimeout,
        window: {
            addEventListener: () => undefined,
            location: { href: hostUrl }
        },
        XMLHttpRequest: function () { }
    };

    vm.runInNewContext(script, context);
    return context.withLocale as (url: string) => string;
}

describe("legacy Tutorial Tool iframe URLs", () => {
    it("propagates an explicit forcelang through the real legacy helper", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool?forcelang=fr");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1"));
        expect(url.searchParams.get("forcelang")).to.equal("fr");
        expect(url.searchParams.get("controller")).to.equal("1");
    });

    it("preserves an embedded locale, unrelated parameters, and fragments", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool?lang=de");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1&lang=es-ES&foo=a%20b#pub:123"));
        expect(url.searchParams.get("lang")).to.equal("es-ES");
        expect(url.searchParams.get("foo")).to.equal("a b");
        expect(url.hash).to.equal("#pub:123");
    });
});
