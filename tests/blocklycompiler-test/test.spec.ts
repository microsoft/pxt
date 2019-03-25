/// <reference path="..\..\localtypings\pxtblockly.d.ts" />
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
        switches: {}
    },
    bundledpkgs: {},
    appTheme: {},
    tsprj: undefined,
    runtime: {
        pauseUntilBlock: { category: "Loops", color: "0x0000ff" }
    },
    blocksprj: undefined,
    corepkg: undefined
});

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
        if (!BlocklyCompilerTestHost.cachedFiles["pxt-core.d.ts"]) {
            return ts.pxtc.Util.httpGetTextAsync(WEB_PREFIX + "/common/pxt-core.d.ts")
                .then(res => {
                    BlocklyCompilerTestHost.cachedFiles["pxt-core.d.ts"] = res;
                    return ts.pxtc.Util.httpGetTextAsync(WEB_PREFIX + "/common/pxt-helpers.ts")
                })
                .then(res => {
                    BlocklyCompilerTestHost.cachedFiles["pxt-helpers.ts"] = res;
                    return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/test-library/pxt.json')
                })
                .then(res => {
                    BlocklyCompilerTestHost.cachedFiles[`test-library/pxt.json`] = res;
                    let json: pxt.PackageConfig;

                    try {
                        json = JSON.parse(res);
                    }
                    catch (e) { }

                    if (json && json.files && json.files.length) {
                        return Promise.all(json.files.map(f => {
                            return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/test-library/' + f)
                                .then(txt => {
                                    BlocklyCompilerTestHost.cachedFiles[`test-library/${f}`] = txt;
                                });
                        }))
                            .then(() => { });
                    }

                    return Promise.resolve()
                })
                .then(() => {
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
                    "dependencies": {
                        "testlib": "file:."
                    },
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

        if (module.id == "testlib") {
            const split = filename.split(/[/\\]/);
            filename = "test-library/" + split[split.length - 1];
            return BlocklyCompilerTestHost.cachedFiles[filename];
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

function blockTestAsync(name: string) {
    let blocksFile: string;
    let tsFile: string;
    return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/tests/' + name + '.blocks')
        .then(res => {
            blocksFile = res;
            return pxt.Util.httpGetTextAsync(WEB_PREFIX + '/baselines/' + name + '.ts')
        }, err => fail(`Unable to get ${name}.blocks: ` + JSON.stringify(err)))
        .then(res => {
            tsFile = res;
            return getBlocksInfoAsync();
        }, err => fail(`Unable to get ${name}.ts: ` + JSON.stringify(err)))
        .then(blocksInfo => {
            const workspace = new Blockly.Workspace();
            (Blockly as any).mainWorkspace = workspace;
            const xml = Blockly.Xml.textToDom(blocksFile);
            pxt.blocks.domToWorkspaceNoEvents(xml, workspace);
            return pxt.blocks.compileAsync(workspace, blocksInfo)
        }, err => fail(`Unable to get block info: ` + JSON.stringify(err)))
        .then((res: pxt.blocks.BlockCompilationResult) => {
            chai.expect(res).to.not.be.undefined;

            const compiledTs = res.source.trim().replace(/\s+/g, " ");
            const baselineTs = tsFile.trim().replace(/\s+/g, " ");

            if (compiledTs !== baselineTs) {
                console.log(compiledTs);
            }

            chai.assert(compiledTs === baselineTs, "Compiled result did not match baseline: " + name + " " + res.source);
        }, err => fail('Compiling blocks failed'));
}

describe("blockly compiler", function () {
    this.timeout(5000);

    describe("compiling lists", () => {
        it("should handle unambiguously typed list generics", (done: () => void) => {
            blockTestAsync("lists_generics1").then(done, done);
        });

        it("should handle generic types of lists with empty inputs", (done: () => void) => {
            blockTestAsync("lists_generics2").then(done, done);
        });

        it("should handle generic list return types in uninitialized lists", (done: () => void) => {
            blockTestAsync("lists_generics3").then(done, done);
        });

        it("should handle generic list return types from non-builtin blocks", (done: () => void) => {
            blockTestAsync("lists_generics4").then(done, done);
        });

        it("should handle generic lists types that reference each other", (done: () => void) => {
            blockTestAsync("lists_generics5").then(done, done);
        });

        it("should handle empty inputs in list blocks by placing literals", (done: () => void) => {
            blockTestAsync("lists_empty_inputs2").then(done, done);
        });

        it("should properly place semicolons when necessary", (done: () => void) => {
            blockTestAsync("lists_semicolons").then(done, done);
        });

        it("should properly handle type declaration for double arrays", (done: () => void) => {
            blockTestAsync("lists_double_arrays").then(done, done);
        });

        it("should not place semicolons in expressions", (done: () => void) => {
            blockTestAsync("lists_semicolons2").then(done, done);
        });

        it("should not infinitely recurse if both parent and child types are not concrete", (done: () => void) => {
            blockTestAsync("lists_infinite").then(done, done);
        });

        it("should not infinitely recurse for unininitialized arrays used in a for of loop", (done: () => void) => {
            blockTestAsync("lists_infinite2").then(done, done);
        });

        it("should not declare lists as strings when using the length block", (done: () => void) => {
            blockTestAsync("lists_length_with_for_of").then(done, done);
        });

        it("should handle empty array blocks", (done: () => void) => {
            blockTestAsync("lists_empty_arrays").then(done, done);
        });

        it("should handle functions with list return types", (done: () => void) => {
            blockTestAsync("array_return_type").then(done, done);
        });
    });

    describe("compiling logic", () => {
        it("should handle all the logic blocks in the toolbox", (done: () => void) => {
            blockTestAsync("logic_all").then(done, done);
        });

        it("should handle all the logic operators", (done: () => void) => {
            blockTestAsync("logic_all_operators").then(done, done);
        });
    });

    describe("compiling math", () => {
        it("should handle all the math operators", (done: () => void) => {
            blockTestAsync("math_operators").then(done, done);
        });

        it("should handle all the math library functions", (done: () => void) => {
            blockTestAsync("math_library").then(done, done);
        });

        it("should handle exponentiation operator", (done: () => void) => {
            blockTestAsync("math_exponents").then(done, done);
        });
    });

    describe("compiling text", () => {
        it("should handle the text blocks", (done: () => void) => {
            blockTestAsync("text").then(done, done);
        });

        it("should handle text join", (done: () => void) => {
            blockTestAsync("text_join").then(done, done);
        });
    });

    describe("compiling loops", () => {
        it("should handle the loops blocks", (done: () => void) => {
            blockTestAsync("loops").then(done, done);
        });

        it("should generate proper variable declarations for loop variables", (done: () => void) => {
            blockTestAsync("loops_local_variables").then(done, done);
        });
    });

    describe("compiling variables", () => {
        it("should handle the variables blocks", (done: () => void) => {
            blockTestAsync("variables").then(done, done);
        });

        it("should change invalid names and preserve unicode names", (done: () => void) => {
            blockTestAsync("variables_names").then(done, done);
        });

        it("should change variable names that collide with tagged template function names", (done: () => void) => {
            blockTestAsync("tagged_template_variable").then(done, done);
        });

        it("should change function names that collide with tagged template function names", (done: () => void) => {
            blockTestAsync("tagged_template_function").then(done, done);
        });

        it("should change variable and function names that collide with namespace names", (done: () => void) => {
            blockTestAsync("namespace_variable_rename").then(done, done);
        });

        it("should change reserved names", (done: () => void) => {
            blockTestAsync("variables_reserved_names").then(done, done);
        });

        it("should handle collisions with variables declared by the destructuring mutator", (done: () => void) => {
            blockTestAsync("old_radio_mutator").then(done, done);
        });

        it("should handle collisions with variables declared by callback arguments", (done: () => void) => {
            blockTestAsync("new_radio_block").then(done, done);
        });

        it("should handle collisions with variables declared by the minecraft destructuring mutator", (done: () => void) => {
            blockTestAsync("mc_old_chat_blocks").then(done, done);
        });

        it("should handle collisions with variables declared by optional callback arguments", (done: () => void) => {
            blockTestAsync("mc_chat_blocks").then(done, done);
        });

        it("should hoist variable declarations when the first set references the target", (done: () => void) => {
            blockTestAsync("self_reference_vars").then(done, done);
        });

        it("should allow variables declared in a for-loop at the top of on-start", (done: () => void) => {
            blockTestAsync("on_start_with_for_loop").then(done, done);
        });

        it("should handle variables declared within grey blocks", (done: () => void) => {
            blockTestAsync("grey_block_declared_vars").then(done, done);
        });

        it("should declare variable types when the initializer expression has a generic type", (done: () => void) => {
            blockTestAsync("array_type_declaration_in_set").then(done, done);
        });
    });

    describe("compiling functions", () => {
        it("should handle name collisions", (done: () => void) => {
            blockTestAsync("functions_names").then(done, done);
        });

        it("should handle function declarations", (done: () => void) => {
            blockTestAsync("functions_v2").then(done, done);
        });

        it("should handle function reporters", (done: () => void) => {
            blockTestAsync("functions_v2_reporters").then(done, done);
        });

        it("should narrow variable types when used as function call arguments", (done: () => void) => {
            blockTestAsync("function_call_inference").then(done, done);
        });
    });

    describe("compiling special blocks", () => {
        it("should compile the predicate in pause until", done => {
            blockTestAsync("pause_until").then(done, done);
        });

        it("should implicitly convert arguments marked as toString to a string", done => {
            blockTestAsync("to_string_arg").then(done, done);
        });

        it("should convert handler parameters to draggable variables", done => {
            blockTestAsync("draggable_parameters").then(done, done);
        });

        it("should set the right check for primitive draggable parameters in blockly loader", done => {
            blockTestAsync("draggable_primitive_reporter").then(done, done);
        });
    });

    describe("compiling expandable blocks", () => {
        it("should handle blocks with optional arguments", done => {
            blockTestAsync("expandable_basic").then(done, done);
        });
    });

    describe("compiling ENUM_GET blocks", () => {
        it("should handle simple enum values", done => {
            blockTestAsync("enum_define").then(done, done);
        });

        describe("with start value set", () => {
            it("should handle conformant values", done => {
                blockTestAsync("enum_define_start_value").then(done, done);
            });

            it("should compile values even if they are invalid", done => {
                blockTestAsync("enum_define_start_value_bad_start").then(done, done);
            });
        });

        describe("with bit mask set", () => {
            it("should handle conformant values", done => {
                blockTestAsync("enum_define_bit_mask").then(done, done);
            });

            it("should compile values even if they are invalid", done => {
                blockTestAsync("enum_define_bit_mask_bad_values").then(done, done);
            });
        });
    });

    describe("compiling events blocks", () => {
        it("should handle APIs where the handler's type uses the Action alias", done => {
            blockTestAsync("action_event").then(done, done);
        });
    })
});