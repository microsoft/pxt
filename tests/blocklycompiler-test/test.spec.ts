/// <reference path="..\..\typings\globals\mocha\index.d.ts" />
/// <reference path="..\..\localtypings\chai.d.ts" />
/// <reference path="..\..\localtypings\blockly.d.ts" />
/// <reference path="..\..\built\pxtblocks.d.ts" />
/// <reference path="..\..\built\pxtcompiler.d.ts" />

const WEB_PREFIX = "http://localhost:9876";

// Blockly crashes if this isn't defined
(Blockly as any).Msg.DELETE_VARIABLE = "Delete the '%1' variable";

// Just needs to exist
pxt.setAppTarget({
    id: "core",
    name: "Microsoft MakeCode",
    title: "Microsoft MakeCode",
    versions: undefined,
    description: "A toolkit to build JavaScript Blocks editors.",
    bundleddirs: [],
    compile: {
        isNative: false,
        hasHex: false,
        jsRefCounting: true,
        floatingPoint: false
    },
    bundledpkgs: {},
    appTheme: {},
    tsprj: undefined,
    blocksprj: undefined,
    corepkg: undefined
});

// Webworker needs this config to run
pxt.webConfig = {
    relprefix: undefined,
    workerjs: WEB_PREFIX + "/blb/worker.js",
    tdworkerjs: undefined,
    monacoworkerjs: undefined,
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
        if (!BlocklyCompilerTestHost.cachedFiles["pxt-core.d.ts"]) {
            return pxt.Util.httpGetTextAsync(WEB_PREFIX + "/common/pxt-core.d.ts")
            .then(res => {
                BlocklyCompilerTestHost.cachedFiles["pxt-core.d.ts"] = res;
                return pxt.Util.httpGetTextAsync(WEB_PREFIX + "/common/pxt-helpers.ts")
            })
            .then(res => {
                BlocklyCompilerTestHost.cachedFiles["pxt-helpers.ts"] = res;
                return new BlocklyCompilerTestHost();
            })
        }

        return Promise.resolve(new BlocklyCompilerTestHost())
    }

    constructor() {
    }

    readFile(module: pxt.Package, filename: string): string {
        if (module.id == "this") {
            if (filename == "pxt.json") {
                return JSON.stringify({
                    "name": "blocklycompilertest",
                    "dependencies": [],
                    "description": "",
                    "files": [
                        "main.blocks",
                        "main.ts",
                        "pxt-core.d.ts",
                        "pxt-helpers.ts"
                    ]
                });
            }
            else if (filename == "main.blocks") {
                return "";
            }
            else if (filename == "pxt-core.d.ts" || filename == "pxt-helpers.ts") {
                return BlocklyCompilerTestHost.cachedFiles[filename];
            }
        } else if (pxt.appTarget && pxt.appTarget.bundledpkgs[module.id] && filename === pxt.CONFIG_NAME) {
            return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
        }

        return "";
    }

    writeFile(module: pxt.Package, filename: string, contents: string): void {
        if (filename == pxt.CONFIG_NAME)
            return; // ignore config writes
        throw Util.oops("trying to write " + module + " / " + filename)
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
            let apis = pxtc.getApiInfo(resp.ast);
            let blocksInfo = pxtc.getBlocksInfo(apis);
            pxt.blocks.initBlocks(blocksInfo);

            cachedBlocksInfo = blocksInfo;

            return cachedBlocksInfo;
        }, err => fail('Could not get compile options'))
}

function blockTestAsync(name: string) {
    let blocksFile: string;
    let tsFile: string;
    return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/tests/' + name + '.blocks')
        .then(res =>  {
            blocksFile = res;
            return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/baselines/' + name + '.ts')
        }, err => fail(`Unable to get ${name}.blocks: ` + JSON.stringify(err)))
        .then(res => {
            tsFile = res;
            return getBlocksInfoAsync();
        }, err => fail(`Unable to get ${name}.ts: ` + JSON.stringify(err)))
        .then(blocksInfo => {
            const workspace = new Blockly.Workspace();
            const xml = Blockly.Xml.textToDom(blocksFile);
            Blockly.Xml.domToWorkspace(xml, workspace);

            return pxt.blocks.compileAsync(workspace, blocksInfo)
        }, err => fail(`Unable to get block info: ` + JSON.stringify(err)))
        .then((res: pxt.blocks.BlockCompilationResult) => {
            chai.expect(res).to.not.be.undefined;

            const compiledTs = res.source.trim().replace(/\s+/g, " ");
            const baselineTs = tsFile.trim().replace(/\s+/g, " ");

            chai.assert(compiledTs === baselineTs, "Compiled result did not match baseline");
        }, err => fail('Compiling blocks failed'));
}

describe("blockly compiler", () => {
    describe("compiling lists", () => {
        it("should handle unambiguously typed list generics", done => {
            blockTestAsync("lists_generics1").then(done, done);
        });

        it("should handle generic types of lists with empty inputs", done => {
            blockTestAsync("lists_generics2").then(done, done);
        });

        it("should handle generic list return types in uninitialized lists", done => {
            blockTestAsync("lists_generics3").then(done, done);
        });

        it("should handle generic list return types from non-builtin blocks", done => {
            blockTestAsync("lists_generics4").then(done, done);
        });

        it("should handle generic lists types that reference each other", done => {
            blockTestAsync("lists_generics5").then(done, done);
        });

        it("should handle empty inputs in list blocks by placing literals", done => {
            blockTestAsync("lists_empty_inputs2").then(done, done);
        });

        it("should properly place semicolons when necessary", done => {
            blockTestAsync("lists_semicolons").then(done, done);
        });

        it("should properly handle type declaration for double arrays", done => {
            blockTestAsync("lists_double_arrays").then(done, done);
        });

        it("should not place semicolons in expressions", done => {
            blockTestAsync("lists_semicolons2").then(done, done);
        });

        it("should not infinitely recurse if both parent and child types are not concrete", done => {
            blockTestAsync("lists_infinite").then(done, done);
        });

        it("should not infinitely recurse for unininitialized arrays used in a for of loop", done => {
            blockTestAsync("lists_infinite2").then(done, done);
        });

        it("should not declare lists as strings when using the length block", done => {
            blockTestAsync("lists_length_with_for_of").then(done, done);
        });

        it("should handle empty array blocks", done => {
            blockTestAsync("lists_empty_arrays").then(done, done);
        });
    });

    describe("compiling logic", () => {
        it("should handle all the logic blocks in the toolbox", done => {
            blockTestAsync("logic_all").then(done, done);
        });

        it("should handle all the logic operators", done => {
            blockTestAsync("logic_all_operators").then(done, done);
        });
    });

    describe("compiling math", () => {
        it("should handle all the math operators", done => {
            blockTestAsync("math_operators").then(done, done);
        });

        it("should handle all the math library functions", done => {
            blockTestAsync("math_library").then(done, done);
        });
    });

    describe("compiling text", () => {
        it("should handle the text blocks", done => {
            blockTestAsync("text").then(done, done);
        });

        it("should handle text join", done => {
            blockTestAsync("text_join").then(done, done);
        });
    });

    describe("compiling loops", () => {
        it("should handle the loops blocks", done => {
            blockTestAsync("loops").then(done, done);
        });

        it("should generate proper variable declarations for loop variables", done => {
            blockTestAsync("loops_local_variables").then(done, done);
        });
    });

    describe("compiling variables", () => {
        it("should handle the variables blocks", done => {
            blockTestAsync("variables").then(done, done);
        });

        it("should change invalid names and preserve unicode names", done => {
            blockTestAsync("variables_names").then(done, done);
        });

        it("should change reserved names", done => {
            blockTestAsync("variables_reserved_names").then(done, done);
        });
    });
});