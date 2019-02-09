/// <reference path="..\..\localtypings\pxtblockly.d.ts" />
/// <reference path="..\..\built\pxtblocks.d.ts" />
/// <reference path="..\..\built\pxtcompiler.d.ts" />
/// <reference path="..\..\built\pxteditor.d.ts" />

const WEB_PREFIX = "http://localhost:9876";

interface BlockTestCase {
    packageName: string;
    testFiles: { testName: string, contents: string }[];
}

declare const testJSON: { libsTests: BlockTestCase[], commonTests: BlockTestCase[] };

// Blockly crashes if this isn't defined
(Blockly as any).Msg.DELETE_VARIABLE = "Delete the '%1' variable";

// target.js should be embedded in the page
pxt.setAppTarget((window as any).pxtTargetBundle);

// Webworker needs this config to run
pxt.webConfig = {
    relprefix: undefined,
    verprefix: undefined,
    workerjs: WEB_PREFIX + "/blb/worker.js",
    monacoworkerjs: undefined,
    gifworkerjs: undefined,
    pxtVersion: undefined,
    pxtRelId: undefined,
    pxtCdnUrl: undefined,
    commitCdnUrl: undefined,
    blobCdnUrl: undefined,
    cdnUrl: undefined,
    targetVersion: undefined,
    targetRelId: undefined,
    targetUrl: undefined,
    targetId: undefined,
    simUrl: undefined,
    partsUrl: undefined,
    runUrl: undefined,
    docsUrl: undefined,
    isStatic: undefined,
};

class BlocklyCompilerTestHost implements pxt.Host {
    static cachedFiles: pxt.Map<string> = {};

    static createTestHostAsync() {
        if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendFieldEditors && pxt.editor.initFieldExtensionsAsync) {
            return pxt.editor.initFieldExtensionsAsync({})
            .then(res => {
                if (res.fieldEditors)
                    res.fieldEditors.forEach(fi => {
                        pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                    })
            })
            .then(() => new BlocklyCompilerTestHost())
        }

        return Promise.resolve(new BlocklyCompilerTestHost())
    }

    constructor() {
    }

    readFile(module: pxt.Package, filename: string): string {
        if (module.id == "this" && filename == "pxt.json") {
            return JSON.stringify(pxt.appTarget.blocksprj.config);
        }

        const bundled = pxt.getEmbeddedScript(module.id);

        if (bundled) {
            return bundled[filename];
        }

        return "";
    }

    writeFile(module: pxt.Package, filename: string, contents: string): void {
        if (filename == pxt.CONFIG_NAME)
            return; // ignore config writes
        throw ts.pxtc.Util.oops("trying to write " + module + " / " + filename)
    }

    getHexInfoAsync(extInfo: pxtc.ExtensionInfo): Promise<pxtc.HexInfo> {
        return pxt.hex.getHexInfoAsync(this, extInfo)
    }

    cacheStoreAsync(id: string, val: string): Promise<void> {
        return Promise.resolve()
    }

    cacheGetAsync(id: string): Promise<string> {
        return Promise.resolve(null as string)
    }

    downloadPackageAsync(pkg: pxt.Package) {
        return Promise.resolve();
    }
}

function fail(msg: string) {
    chai.assert(false, msg);
}

let cachedBlocksInfo: pxtc.BlocksInfo;

function getBlocksInfoAsync(): Promise<pxtc.BlocksInfo> {
    if (cachedBlocksInfo) {
        return Promise.resolve(cachedBlocksInfo);
    }

    return BlocklyCompilerTestHost.createTestHostAsync()
        .then(host => {
            const pkg = new pxt.MainPackage(host);
            return pkg.getCompileOptionsAsync();
        }, err => fail('Unable to create test host'))
        .then(opts => {
            opts.ast = true
            let resp = pxtc.compile(opts)
            if (resp.diagnostics && resp.diagnostics.length > 0)
                resp.diagnostics.forEach(diag => console.error(diag.messageText));
            if (!resp.success)
                return Promise.reject("Could not compile");

            // decompile to blocks
            let apis = pxtc.getApiInfo(opts, resp.ast);
            let blocksInfo = pxtc.getBlocksInfo(apis);
            pxt.blocks.initializeAndInject(blocksInfo);

            cachedBlocksInfo = blocksInfo;

            return cachedBlocksInfo;
        }, err => fail('Could not get compile options'))
}

function testXmlAsync(blocksfile: string) {
    return initAsync()
        .then(() => getBlocksInfoAsync())
        .then(blocksInfo => {
            const workspace = new Blockly.Workspace();
            (Blockly as any).mainWorkspace = workspace;
            const xml = Blockly.Xml.textToDom(blocksfile);

            try {
                Blockly.Xml.domToWorkspace(xml, workspace);
            }
            catch (e) {
                if (e.message && e.message.indexOf("isConnected") !== -1) {
                    fail("Could not build workspace, this usually means a blockId (aka blockly 'type') changed")
                }
                fail(e.message);
            }

            const err = compareBlocklyTrees(xml, Blockly.Xml.workspaceToDom(workspace));
            if (err) {
                fail(`XML mismatch (${err.reason}) ${err.chain} \n See https://makecode.com/develop/blockstests for more info`);
            }
        }, err => fail(`Unable to get block info: ` + JSON.stringify(err)))
}

function mkLink(el: Element) {
    let tag = el.tagName.toLowerCase();
    switch (tag) {
        case "block":
        case "shadow":
            return `<${tag} type="${el.getAttribute("type")}">`;
        case "value":
        case "statement":
        case "title":
        case "field":
            return `<${tag} name="${el.getAttribute("name")}">`;

        default:
            return `<${tag}>`;;

    }
}

function compareBlocklyTrees(a: Element, b: Element, prev: string[] = []): { chain: string, reason: string } {
    prev.push(mkLink(a));
    if (!shallowEquals(a, b)) return {
        chain: prev.join(" -> "),
        reason: "mismatched element"
    };

    for (let i = 0; i < a.childNodes.length; i++) {
        const childA = a.childNodes.item(i);
        if (childA.nodeType === Node.ELEMENT_NODE) {
            const childB = getMatchingChild(childA as Element, b);
            if (!childB) return {
                chain: prev.join(" -> "),
                reason: "missing child " + mkLink(childA as Element)
            };

            const err = compareBlocklyTrees(childA as Element, childB as Element, prev.slice());
            if (err) {
                return err;
            }
        }
    }

    return undefined;
}

function getMatchingChild(searchFor: Element, parent: Element) {
    for (let i = 0; i < parent.childNodes.length; i++) {
        const child = parent.childNodes.item(i);
        if (child.nodeType === Node.ELEMENT_NODE && shallowEquals(searchFor, child as Element)) return child;
    }
    return undefined;
}

function shallowEquals(a: Element, b: Element) {
    if (a.tagName.toLowerCase() !== b.tagName.toLowerCase()) return false;

    switch (a.tagName.toLowerCase()) {
        case "block":
        case "shadow":
            return a.getAttribute("type") === b.getAttribute("type");
        case "value":
        case "statement":
            return a.getAttribute("name") === b.getAttribute("name");
        case "title":
        case "field":
            return a.getAttribute("name") === b.getAttribute("name") && a.textContent.trim() === b.textContent.trim();
        case "mutation":
            const aAttributes = a.attributes;
            const bAttributes = b.attributes;

            if (aAttributes.length !== bAttributes.length) return false;

            for (let i = 0; i < aAttributes.length; i++) {
                const attrName = aAttributes.item(i).name;
                if (a.getAttribute(attrName) != b.getAttribute(attrName)) return false;
            }
            return a.textContent.trim() === b.textContent.trim();
        case "data":
            return a.textContent.trim() === b.textContent.trim();
        case "next":
        case "comment":
            return true;
    }

    return true;
}

let init = false;

function initAsync() {
    if (init) return Promise.resolve();
    init = true;
    if (pxt.appTarget.appTheme && pxt.appTarget.appTheme.extendFieldEditors && pxt.editor.initFieldExtensionsAsync) {
        return pxt.editor.initFieldExtensionsAsync({})
        .then(res => {
            if (res.fieldEditors)
                res.fieldEditors.forEach(fi => {
                    pxt.blocks.registerFieldEditor(fi.selector, fi.editor, fi.validator);
                })
        })
    }
    return Promise.resolve();
}


function encode(testcase: string) {
    return testcase.split(/[\\\/]/g).map(encodeURIComponent).join("/");
}

if (testJSON.libsTests && testJSON.libsTests.length) {
    describe("block tests in target", function() {
        this.timeout(5000);
        for (const test of testJSON.libsTests) {
            describe("for package " + test.packageName, () => {
                for (const testFile of test.testFiles) {
                    it("file " + testFile.testName, () => testXmlAsync(testFile.contents));
                }
            });
        }
    });
}
if (testJSON.commonTests && testJSON.commonTests.length) {
    describe("block tests in common-packages", function() {
        this.timeout(5000);
        for (const test of testJSON.commonTests) {
            describe("for package " + test.packageName, () => {
                for (const testFile of test.testFiles) {
                    it("file " + testFile.testName, () => testXmlAsync(testFile.contents));
                }
            });
        }
    });
}