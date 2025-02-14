/// <reference path="..\..\localtypings\pxtblockly.d.ts" />
/// <reference path="..\..\built\pxtcompiler.d.ts" />

import * as Blockly from "blockly";
import * as pxtblockly from "../../pxtblocks";
import { DuplicateOnDragConnectionChecker } from "../../pxtblocks/plugins/duplicateOnDrag";

import "./commentparsing.spec";
import "./fieldUserEnum.spec";

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
    serviceworkerjs: undefined,
    typeScriptWorkerJs: undefined,
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
    simserviceworkerUrl: undefined,
    simworkerconfigUrl: undefined,
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
                        pxt.MAIN_BLOCKS,
                        pxt.MAIN_TS,
                        "pxt-core.d.ts",
                        "pxt-helpers.ts"
                    ]
                });
            }
            else if (filename == pxt.MAIN_BLOCKS) {
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
        return pxt.hexloader.getHexInfoAsync(this, extInfo)
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

// @ts-ignore
function fail(msg: string): never {
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
            let apis = pxtc.getApiInfo(resp.ast, opts.jres);
            let blocksInfo = pxtc.getBlocksInfo(apis);
            pxtblockly.initializeAndInject(blocksInfo);

            cachedBlocksInfo = blocksInfo;

            return cachedBlocksInfo;
        }, err => fail('Could not get compile options'))
}

async function blockTestAsync(name: string) {
    let blocksFile: string;
    let tsFile: string;
    const blocklyOptions: Blockly.BlocklyOptions = {
        sounds: true,
        trashcan: false,
        collapse: true,
        comments: true,
        disable: false,
        readOnly: false,
        plugins: {
            // 'blockDragger': pxtblockly.BlockDragger,
            'connectionChecker': DuplicateOnDragConnectionChecker,
            'flyoutsVerticalToolbox': pxtblockly.VerticalFlyout
        },
        move: {
            scrollbars: true,
            wheel: true
        },
        zoom: {
            controls: false,
            maxScale: 2.5,
            minScale: .2,
            scaleSpeed: 1.5,
            startScale: pxt.BrowserUtils.isMobile() ? 0.7 : 0.9,
            pinch: true
        },
        rtl: pxt.Util.isUserLanguageRtl()
    };

    try {
        blocksFile = await pxt.Util.httpGetTextAsync(WEB_PREFIX + '/tests/' + name + '.blocks');
    }
    catch (err) {
        fail(`Unable to get ${name}.blocks: ` + JSON.stringify(err))
    }

    try {
        tsFile = await pxt.Util.httpGetTextAsync(WEB_PREFIX + '/baselines/' + name + '.ts');
    }
    catch (err) {
        fail(`Unable to get ${name}.ts: ` + JSON.stringify(err));
    }

    let blocksInfo: pxtc.BlocksInfo;
    try {
        blocksInfo = await getBlocksInfoAsync();
    }
    catch (err) {
        fail(`Unable to get block info: ` + JSON.stringify(err));
    }

    let res: pxtblockly.BlockCompilationResult;
    try {
        const workspace = new Blockly.Workspace();
        const xml = Blockly.utils.xml.textToDom(blocksFile);
        pxtblockly.domToWorkspaceNoEvents(xml, workspace);
        res = await pxtblockly.compileAsync(workspace, blocksInfo)
    }
    catch (err) {
        fail('Compiling blocks failed with error: ' + err)
    }

    chai.expect(res).to.not.be.undefined;

    const compiledTs = res.source.trim().replace(/\s+/g, " ");
    const baselineTs = tsFile.trim().replace(/\s+/g, " ");

    if (compiledTs !== baselineTs) {
        console.log(compiledTs);
    }

    chai.assert(compiledTs === baselineTs, "Compiled result did not match baseline: " + name + " " + res.source);
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

        it("should not declare strings as stris when using for each string block", (done: () => void) => {
            blockTestAsync("for_each_string").then(done, done);
        });

        it("should handle empty array blocks", (done: () => void) => {
            blockTestAsync("lists_empty_arrays").then(done, done);
        });

        it("should handle functions with list return types", (done: () => void) => {
            blockTestAsync("array_return_type").then(done, done);
        });

        it("should correctly infer types for arrays initialized to empty", (done: () => void) => {
            blockTestAsync("empty_array_inference").then(done, done);
        });

        it("should give variables that are only assigned the empty array a type of number[]", (done: () => void) => {
            blockTestAsync("just_empty_array").then(done, done);
        });

        it("should compile aliases for pop, shift, unshift, and removeAt", (done: () => void) => {
            blockTestAsync("array_aliases").then(done, done);
        });
    });

    describe("compiling logic", () => {
        it("should handle all the logic blocks in the toolbox", (done: () => void) => {
            blockTestAsync("logic_all").then(done, done);
        });

        it("should handle all the logic operators", (done: () => void) => {
            blockTestAsync("logic_all_operators").then(done, done);
        });

        it("should handle non-number inputs in logic operators", (done: () => void) => {
            blockTestAsync("logic_non_numeric").then(done, done);
        });

        it("should handle literals being compared", (done: () => void) => {
            blockTestAsync("compare_literals").then(done, done);
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

        it("should change variable names when escaped name matches", (done: () => void) => {
            blockTestAsync("escaped_name_equal").then(done, done);
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

        it("shouldn't pollute the global primitive types when unifying variables", (done: () => void) => {
            blockTestAsync("primitive_type_inference").then(done, done);
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

        it("should handle return statements", (done: () => void) => {
            blockTestAsync("return_statement").then(done, done);
        });

        it("should handle functions that return values", (done: () => void) => {
            blockTestAsync("function_output").then(done, done);
        });

        it("should output a return type for recursive functions", (done: () => void) => {
            blockTestAsync("function_recursion").then(done, done);
        });

        it("should bail out of type checking when a recursive function calls itself", (done: () => void) => {
            blockTestAsync("function_bad_recursion").then(done, done);
        });

        it("should handle an array of arrays as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_arrays").then(done, done);
        })

        it("should handle an array of strings as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_strings").then(done, done);
        })

        it("should handle a variable as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_variable").then(done, done);
        })

        it("should handle an array of variables as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_variables").then(done, done);
        })

        it("should handle an empty array as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_empty").then(done, done);
        })

        it("should handle an array of booleans as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_booleans").then(done, done);
        })

        it("should handle an array of empty arrays as array argument", (done: () => void) => {
            blockTestAsync("array_parameter_empty_arrays").then(done, done);
        })

        it("should perform type inference on array arguments", (done: () => void) => {
            blockTestAsync("array_parameter_type_inference").then(done, done);
        })
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

        it("should convert enums to constants when emitAsConstant is set", done => {
            blockTestAsync("enum_constants").then(done, done);
        });

        it("should compile gridTemplate blocks to template strings", done => {
            blockTestAsync("grid_template_string").then(done, done);
        })
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

    describe("compiling KIND_GET blocks", () => {
        it("should declare namespaces for declared kinds", done =>{
            blockTestAsync("sprite_kind").then(done, done);
        });
    });

    describe("compiling events blocks", () => {
        it("should handle APIs where the handler's type uses the Action alias", done => {
            blockTestAsync("action_event").then(done, done);
        });
    })

    describe("compiling variable set", () => {
        it("should attempt narrow types to the most specific type when set", done => {
            blockTestAsync("inheritance").then(done, done);
        });
    })
});