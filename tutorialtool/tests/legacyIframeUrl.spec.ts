import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

function loadLegacyWithLocale(hostUrl: string, language = "en") {
    const script = fs.readFileSync(path.resolve("docs/static/tutorial-tool/tutorial.js"), "utf8");

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
        URLSearchParams,
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
        navigator: { language },
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

    it("decodes and propagates an encoded lang through the real legacy helper", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool?lang=pt%2DBR");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1"));
        expect(url.searchParams.get("lang")).to.equal("pt-BR");
        expect(url.searchParams.has("forcelang")).to.equal(false);
    });

    it("decodes and propagates an encoded forcelang through the real legacy helper", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool?forcelang=pt%2DBR");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1"));
        expect(url.searchParams.get("forcelang")).to.equal("pt-BR");
        expect(url.searchParams.has("lang")).to.equal(false);
    });

    it("preserves an embedded locale, unrelated parameters, and fragments", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool?lang=de");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1&lang=es-ES&foo=a%20b#pub:123"));
        expect(url.searchParams.get("lang")).to.equal("es-ES");
        expect(url.searchParams.get("foo")).to.equal("a b");
        expect(url.hash).to.equal("#pub:123");
    });

    it("does not override the editor fallback when the host has no explicit locale", () => {
        const withLocale = loadLegacyWithLocale("https://makecode.com/tutorial-tool", "fr");
        const url = new URL(withLocale("https://arcade.makecode.com/?controller=1"));
        expect(url.searchParams.has("lang")).to.equal(false);
        expect(url.searchParams.has("forcelang")).to.equal(false);
    });
});
