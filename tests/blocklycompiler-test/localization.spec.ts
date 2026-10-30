/// <reference path="..\..\built\pxtlib.d.ts" />
/// <reference path="..\..\built\pxtcompiler.d.ts" />

describe("block localization", () => {
    const ENGLISH = "%this=text| is empty";

    async function localizeBlock(translated: string): Promise<string> {
        const fn = {
            kind: pxtc.SymbolKind.Method,
            name: "isEmpty",
            namespace: "String",
            qName: "String.isEmpty",
            isInstance: true,
            parameters: [] as pxtc.ParameterDesc[],
            retType: "boolean",
            attributes: pxtc.parseCommentString(`//% blockId=string_isempty block="${ENGLISH}"`),
        } as pxtc.SymbolInfo;
        const apis = { byQName: { [fn.qName]: fn }, jres: {} } as pxtc.ApisInfo;
        const mainPkg = {
            localizationStringsAsync: () => Promise.resolve({ [`${fn.qName}|block`]: translated }),
        } as any as pxt.MainPackage;

        const previousLang = pxt.Util.userLanguage();
        pxt.Util.setUserLanguage("pt-BR");
        try {
            await pxtc.localizeApisAsync(apis, mainPkg);
        } finally {
            pxt.Util.setUserLanguage(previousLang);
        }
        return fn.attributes.block;
    }

    it("should apply a translation that keeps the parameters", async () => {
        const translated = "%this=text|está vazio";
        chai.expect(await localizeBlock(translated)).to.equal(translated);
    });

    it("should keep the English block when the translation renames a parameter", async () => {
        chai.expect(await localizeBlock("%texto=text| está vazio")).to.equal(ENGLISH);
    });

    it("should keep the English block when the translation changes the shadow of %this", async () => {
        chai.expect(await localizeBlock("%this=texto| está vazio")).to.equal(ENGLISH);
    });
});
