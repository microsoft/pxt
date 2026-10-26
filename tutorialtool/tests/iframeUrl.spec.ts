import { expect } from "chai";
import { addLocaleToUrl, createTutorialToolEditorUrl } from "../src/utils/iframeUrl";

describe("Tutorial Tool iframe URLs", () => {
    const host = "https://makecode.com/tt";

    it("leaves the default English URL without a locale parameter", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/?foo=bar#hash", host, "en-US"));
        expect(url.searchParams.has("lang")).to.equal(false);
        expect(url.searchParams.has("forcelang")).to.equal(false);
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.hash).to.equal("#hash");
    });

    it("propagates the resolved locale with lang", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/", host, "fr"));
        expect(url.searchParams.get("lang")).to.equal("fr");
    });

    it("propagates an explicit host forcelang", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/", `${host}?forcelang=fr`, "de"));
        expect(url.searchParams.get("forcelang")).to.equal("fr");
        expect(url.searchParams.has("lang")).to.equal(false);
    });

    it("propagates an explicit host lang", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/", `${host}?lang=de`, "fr"));
        expect(url.searchParams.get("lang")).to.equal("de");
        expect(url.searchParams.has("forcelang")).to.equal(false);
    });

    it("preserves an iframe lang", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/?lang=es-ES", `${host}?forcelang=fr`, "de"));
        expect(url.searchParams.get("lang")).to.equal("es-ES");
        expect(url.searchParams.has("forcelang")).to.equal(false);
    });

    it("preserves an iframe forcelang", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/?forcelang=ja", `${host}?lang=de`, "fr"));
        expect(url.searchParams.get("forcelang")).to.equal("ja");
        expect(url.searchParams.has("lang")).to.equal(false);
    });

    it("preserves unrelated parameters and fragments", () => {
        const url = new URL(addLocaleToUrl("https://arcade.makecode.com/?foo=a%20b#pub:123", host, "pt-BR"));
        expect(url.searchParams.get("foo")).to.equal("a b");
        expect(url.searchParams.get("lang")).to.equal("pt-BR");
        expect(url.hash).to.equal("#pub:123");
    });

    it("sets the required Tutorial Tool iframe parameters", () => {
        const url = new URL(createTutorialToolEditorUrl("https://arcade.makecode.com/?foo=bar#hash", host, "fr"));
        expect(url.searchParams.get("controller")).to.equal("1");
        expect(url.searchParams.get("teachertool")).to.equal("1");
        expect(url.searchParams.get("ws")).to.equal("mem");
        expect(url.searchParams.get("nocookiebanner")).to.equal("1");
        expect(url.searchParams.get("foo")).to.equal("bar");
        expect(url.hash).to.equal("#hash");
    });
});
