/// <reference path="../../built/pxtlib.d.ts"/>

/* eslint-disable import/no-unassigned-import */
import "mocha";
import * as chai from "chai";
import * as path from "path";

import * as localrepos from "../../cli/localrepos";

// the cli modules read pxtlib from the global scope, as they do in pxt.js
(global as any).pxt = pxt;

function extensionTestTarget(): pxt.TargetBundle {
    return {
        id: "extension-test",
        name: "Extension test",
        corepkg: "core",
        compile: { isNative: false, hasHex: false, switches: {} },
        compileService: { serviceId: "native", gittag: "v1", buildEngine: "dockermake" },
        appTheme: {},
        blocksprj: undefined,
        tsprj: undefined,
        bundledpkgs: {},
        bundleddirs: [],
        versions: { target: "1.0.0" }
    };
}

function extensionTestFiles(): pxt.Map<string> {
    return {
        "pxt.json": JSON.stringify({
            name: "project",
            dependencies: {},
            files: ["main.cpp", "shims.d.ts", "enums.d.ts"]
        }),
        "main.cpp": `
namespace test {
    /**
     * Test function.
     */
    //% block="test %value"
    int run(int value = 1) {
        return value;
    }
}
`
    };
}

describe("extension info explicit inputs", () => {
    const descriptors: pxt.Map<PropertyDescriptor> = {};
    let host: pxt.cpp.ExtensionInfoHost;
    let messages: string[];
    let measurements: string[];

    beforeEach(() => {
        messages = [];
        measurements = [];
        host = {
            cache: {},
            logger: {
                debug: message => messages.push(message),
                log: message => messages.push(message)
            },
            perf: {
                measureStart: name => measurements.push("start:" + name),
                measureEnd: name => measurements.push("end:" + name)
            }
        };
        for (const key of ["appTarget", "appTargetVariant", "debug", "perf"]) {
            descriptors[key] = Object.getOwnPropertyDescriptor(pxt, key);
            Object.defineProperty(pxt, key, {
                configurable: true,
                get: () => { throw new Error(`Unexpected global access: pxt.${key}`); }
            });
        }
    });

    afterEach(() => {
        for (const key of Object.keys(descriptors)) {
            if (descriptors[key]) Object.defineProperty(pxt, key, descriptors[key]);
            else Reflect.deleteProperty(pxt, key);
        }
    });

    it("generates shims using only the supplied files, unmodified target and host", () => {
        const target = extensionTestTarget();
        const files = extensionTestFiles();
        Object.freeze(target.compile.switches);
        Object.freeze(target.compile);
        Object.freeze(target.compileService);
        Object.freeze(target);
        Object.freeze(files);
        const result = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(result.shimsDTS).contains("function run(value?: int32): int32;");
        chai.expect(result.functions.map(f => f.name)).deep.equals(["test::run"]);
        chai.expect(result.generatedFiles["/pxtapp/pxtconfig.h"]).contains("#define PXT_UTF8 1");
        chai.expect(result.generatedFiles["/pxtapp/pointers.cpp"]).contains("PXT_FNPTR(::test::run)");
        chai.expect(result.sha).matches(/^[a-f0-9]{64}$/);
        chai.expect(JSON.parse(Buffer.from(result.compileData, "base64").toString()).config).equals("native");
        chai.expect(target.compile.utf8).equals(undefined);
    });

    it("resolves different build engines and compile switches without leaking between variants", () => {
        const target = extensionTestTarget();
        const variant = extensionTestTarget();
        variant.compile = { isNative: false, hasHex: false, nativeType: "vm", switches: { profile: true } };
        variant.compileService = {
            serviceId: "platformio", gittag: "v2", buildEngine: "platformio", platformioIni: ["[env:test]"]
        };
        target.variants = { vm: variant };
        const snapshot = JSON.stringify(target);
        const files = extensionTestFiles();
        const vm = pxt.cpp.getExtensionInfo(files, target, "vm", host);
        const native = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(vm.generatedFiles["/src/pxtconfig.h"]).contains("#define PXT_VM 1");
        chai.expect(vm.generatedFiles["/src/pxtconfig.h"]).contains("#define PXT_PROFILE 1");
        chai.expect(vm.generatedFiles["/src/pointers.cpp"]).contains("_wrp_test__run");
        chai.expect(vm.generatedFiles["/platformio.ini"]).contains("[env:test]");
        chai.expect(vm.platformio.dependencies).deep.equals({});
        chai.expect(native.npmDependencies).deep.equals({});
        chai.expect(native.generatedFiles["/pxtapp/pxtconfig.h"]).not.contains("PXT_VM");
        chai.expect(JSON.stringify(target)).equals(snapshot);
        chai.expect(pxt.cpp.getExtensionInfo(files, target, "vm", host)).deep.equals(vm);
    });

    it("reuses the host cache and emits logger and performance hooks only as needed", () => {
        const files = extensionTestFiles();
        const config = JSON.parse(files["pxt.json"]) as pxt.PackageConfig;
        config.files.push("main.ts");
        files["pxt.json"] = JSON.stringify(config);
        files["main.ts"] = "// first";
        const target = extensionTestTarget();
        const first = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(messages[0]).equals("Generating new extinfo");
        chai.expect(messages.some(message => message.indexOf("pxtconfig.h:") == 0)).equals(true);
        chai.expect(measurements).deep.equals(["start:sha256buffer", "end:sha256buffer"]);
        files["main.ts"] = "// second";
        const second = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(second).deep.equals(first);
        chai.expect(second).not.equals(first);
        chai.expect(messages[messages.length - 1]).equals("Using cached extinfo");
        chai.expect(measurements.length).equals(2);
        pxt.cpp.getExtensionInfo(files, target, undefined, { ...host, cache: {} });
        chai.expect(messages.filter(message => message == "Generating new extinfo").length).equals(2);
        chai.expect(measurements.length).equals(4);
    });

    it("honors file conditions, test files, C++ dependencies and disabled variants", () => {
        const target = extensionTestTarget();
        const files: pxt.Map<string> = {
            "pxt.json": JSON.stringify({
                name: "project", files: ["main.cpp", "excluded.cpp"], testFiles: ["test.cpp"],
                dependencies: { feature: "pub:feature" }, cppDependencies: { native: "embed:native" },
                fileDependencies: { "excluded.cpp": "!feature", "main.cpp": "feature && !native || target:other" }
            }),
            "main.cpp": "// enabled",
            "test.cpp": "// tests",
            "pxt_modules/feature/pxt.json": JSON.stringify({
                name: "feature", files: ["feature.cpp"], dependencies: {}, disablesVariants: ["disabled"], utf8: true
            }),
            "pxt_modules/feature/feature.cpp": "// feature",
            "pxt_modules/native/pxt.json": JSON.stringify({
                name: "native", files: ["native.cpp"], dependencies: {}
            }),
            "pxt_modules/native/native.cpp": "// native"
        };
        target.compile.utf8 = false;
        target.variants = { disabled: extensionTestTarget() };
        const enabled = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(enabled.extensionFiles["/pxtapp/project/main.cpp"]).equals("// enabled");
        chai.expect(enabled.extensionFiles["/pxtapp/project/test.cpp"]).equals("// tests");
        chai.expect(enabled.extensionFiles["/pxtapp/project/excluded.cpp"]).equals(undefined);
        chai.expect(enabled.extensionFiles["/pxtapp/native/native.cpp"]).equals("// native");
        chai.expect(enabled.generatedFiles["/pxtapp/pxtconfig.h"]).contains("PXT_UTF8");
        const disabled = pxt.cpp.getExtensionInfo(files, target, "disabled", host);
        chai.expect(disabled.disabledDeps).equals("feature, this");
        chai.expect(disabled.extensionFiles["/pxtapp/feature/feature.cpp"]).equals(undefined);
        chai.expect(disabled.shimsDTS).equals("");
        chai.expect(disabled.onlyPublic).equals(true);
    });

    it("includes native test dependencies only when their files are supplied", () => {
        const files: pxt.Map<string> = {
            "pxt.json": JSON.stringify({
                name: "project", files: [], dependencies: {},
                testDependencies: { test: "*", unavailable: "*" }
            }),
            "pxt_modules/test/pxt.json": JSON.stringify({
                name: "test", files: ["test.cpp"], dependencies: {}
            }),
            "pxt_modules/test/test.cpp": "// test dependency"
        };
        chai.expect(pxt.cpp.getExtensionInfo(files, extensionTestTarget(), undefined, host)
            .extensionFiles["/pxtapp/test/test.cpp"]).equals("// test dependency");
    });

    it("does not reuse stale or caller-mutated results for changed native inputs", () => {
        const target = extensionTestTarget();
        const files = extensionTestFiles();
        const config = JSON.parse(files["pxt.json"]) as pxt.PackageConfig;
        config.files.push("source.c", "startup.S", "Makefile");
        files["pxt.json"] = JSON.stringify(config);
        files["source.c"] = "// first";
        files["startup.S"] = "// assembly";
        files["Makefile"] = "# first";
        const first = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        first.generatedFiles["/pxtapp/pxtconfig.h"] = "caller mutation";
        const cached = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        cached.generatedFiles["/pxtapp/pxtconfig.h"] = "cache hit mutation";
        chai.expect(pxt.cpp.getExtensionInfo(files, target, undefined, host)
            .generatedFiles["/pxtapp/pxtconfig.h"]).not.equals("caller mutation");
        chai.expect(pxt.cpp.getExtensionInfo(files, target, undefined, host)
            .generatedFiles["/pxtapp/pxtconfig.h"]).not.equals("cache hit mutation");
        files["source.c"] = "// second";
        const changedSource = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(changedSource.sha).not.equals(first.sha);
        files["Makefile"] = "# second";
        const changedMakefile = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(changedMakefile.sha).not.equals(changedSource.sha);
        target.compileService.gittag = "v2";
        const second = pxt.cpp.getExtensionInfo(files, target, undefined, host);
        chai.expect(second.sha).not.equals(changedMakefile.sha);
        chai.expect(second.extensionFiles["/pxtapp/project/source.c"]).equals("// second");
        chai.expect(second.extensionFiles["/pxtapp/project/startup.s"]).equals("// assembly");
        chai.expect(second.generatedFiles["/Makefile"]).equals("# second");
        chai.expect(second.generatedFiles["/Makefile.inc"]).contains("pxtapp/project/source.c");
    });

    it("reports configuration conflicts with package identifiers", () => {
        const files: pxt.Map<string> = {
            "pxt.json": JSON.stringify({
                name: "project", files: [], dependencies: { a: "*", b: "*" }
            }),
            "pxt_modules/a/pxt.json": JSON.stringify({
                name: "a", files: [], dependencies: {}, yotta: { config: { setting: 1 } }
            }),
            "pxt_modules/b/pxt.json": JSON.stringify({
                name: "b", files: [], dependencies: {}, yotta: { config: { setting: 2 } }
            })
        };
        let conflict: pxt.cpp.PkgConflictError;
        try {
            pxt.cpp.getExtensionInfo(files, extensionTestTarget(), undefined, host);
        } catch (e) {
            if (!(e instanceof pxt.cpp.PkgConflictError)) throw e;
            conflict = e;
        }
        chai.assert.isDefined(conflict);
        chai.expect(conflict.pkg0Id).equals("a");
        chai.expect(conflict.pkg1Id).equals("b");
        chai.expect(conflict.settingName).equals("setting");
    });

    it("reports missing variants and missing native source files", () => {
        const files = extensionTestFiles();
        const target = extensionTestTarget();
        chai.expect(() => pxt.cpp.getExtensionInfo(files, target, "missing", host)).throws("Variant 'missing'");
        delete files["main.cpp"];
        chai.expect(() => pxt.cpp.getExtensionInfo(files, target, undefined, host)).throws("C++ file main.cpp is missing");
    });
});

describe("package extension info integration", () => {
    it("compiles all variants without switching or mutating the active target", async () => {
        const previousTarget = pxt.appTarget;
        const previousVariant = pxt.appTargetVariant;
        const setVariant = pxt.setAppTargetVariant;
        const target = extensionTestTarget();
        const first = extensionTestTarget();
        first.compileService = { serviceId: "codal", gittag: "v1", buildEngine: "codal" };
        const second = extensionTestTarget();
        second.compile.switches.profile = true;
        target.variants = { first, second };
        target.multiVariants = ["first", "second"];
        target.alwaysMultiVariant = true;
        const files = extensionTestFiles();
        const host: pxt.Host = {
            readFile: (pkg, name) => files[(pkg.id == "this" ? "" : "pxt_modules/" + pkg.id + "/") + name],
            writeFile: (pkg, name, content) => { files[name] = content; },
            downloadPackageAsync: async () => { throw new Error("Unexpected package download"); },
            getHexInfoAsync: async () => { throw new Error("Unexpected native compilation"); },
            cacheStoreAsync: async () => {},
            cacheGetAsync: async () => undefined
        };
        try {
            pxt.appTargetVariant = undefined;
            pxt.setAppTarget(target);
            const activeTarget = pxt.appTarget;
            const snapshot = JSON.stringify(activeTarget);
            pxt.setAppTargetVariant = () => { throw new Error("Unexpected target switching"); };
            const pkg = new pxt.MainPackage(host);
            pkg.isLoaded = true;
            pkg.loadConfig(true);
            const options = await pkg.getCompileOptionsAsync({
                ...pkg.getTargetOptions(),
                keepCppFiles: true
            });
            chai.expect(options.extinfo.appVariant).equals("first");
            chai.expect(options.extinfo.codal).not.equals(undefined);
            chai.expect(options.otherMultiVariants.length).equals(1);
            const other = options.otherMultiVariants[0];
            chai.expect(other.extinfo.appVariant).equals("second");
            chai.expect(other.extinfo.generatedFiles["/pxtapp/pxtconfig.h"]).contains("#define PXT_PROFILE 1");
            chai.expect(other.target.switches.profile).equals(true);
            chai.expect(pxt.appTarget).equals(activeTarget);
            chai.expect(JSON.stringify(pxt.appTarget)).equals(snapshot);
            chai.expect(pxt.appTargetVariant).equals(undefined);
        } finally {
            pxt.setAppTargetVariant = setVariant;
            if (previousTarget) pxt.setAppTarget(previousTarget);
            else pxt.appTarget = previousTarget;
            pxt.appTargetVariant = previousVariant;
        }
    });
});

const fixturesDir = path.resolve("tests", "cli-test", "localrepos");
const monoDir = path.join(fixturesDir, "mono");

class CapturingLogger extends pxt.ConsoleLogger {
    errors: string[] = [];

    error(...args: any[]) {
        this.errors.push(args.join(" "));
    }
}

function expectStatus(f: () => any, statusCode: number, messagePart: string) {
    let err: any;
    try {
        f();
    } catch (e) {
        err = e;
    }
    chai.expect(err, "expected an error").to.exist;
    chai.expect(err.statusCode).equals(statusCode);
    chai.expect(err.message).contains(messagePart);
}

function expectUserError(f: () => any) {
    let err: any;
    try {
        f();
    } catch (e) {
        err = e;
    }
    chai.expect(err, "expected an error").to.exist;
    chai.expect(err.isUserError).equals(true);
}

describe("local repos config", () => {
    it("reads pxtlocal.json, resolving directories against the target directory", () => {
        const repos = localrepos.loadLocalRepos(path.join(fixturesDir, "target"), [], "/");
        chai.expect(repos).deep.equals({ "owner/mono": monoDir });
    });

    it("returns no repositories without pxtlocal.json or flags", () => {
        chai.expect(localrepos.loadLocalRepos(monoDir, [], "/")).deep.equals({});
    });

    it("applies --local-repo values over pxtlocal.json, resolving directories against the working directory", () => {
        const repos = localrepos.loadLocalRepos(path.join(fixturesDir, "target"), [
            "owner/mono=ext",
            "Other/Repo=" + monoDir
        ], monoDir);
        chai.expect(repos).deep.equals({
            "owner/mono": path.join(monoDir, "ext"),
            "other/repo": monoDir
        });
    });

    it("rejects entries that are not owner/repo", () => {
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono/ext=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono#v1.0.0=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner=" + monoDir], "/"));
        expectUserError(() => localrepos.loadLocalRepos(monoDir, [monoDir], "/"));
    });

    it("rejects directories that do not exist", () => {
        expectUserError(() => localrepos.loadLocalRepos(monoDir, ["owner/mono=missing"], monoDir));
    });

    it("rejects a pxtlocal.json that is not JSON", () => {
        expectUserError(() => localrepos.loadLocalRepos(path.join(fixturesDir, "badjson"), [], "/"));
    });
});

describe("local repos requests", () => {
    const repos = { "owner/mono": monoDir };
    let logger: CapturingLogger;

    beforeEach(() => {
        logger = new CapturingLogger();
        pxt.setLogger(logger);
    });

    afterEach(() => {
        pxt.setLogger(new pxt.ConsoleLogger());
    });

    it("answers repository metadata", () => {
        chai.expect(localrepos.resolveLocalRepoRequest(repos, "owner/mono")).deep.equals({
            name: "mono",
            description: "Monorepo root"
        });
    });

    it("answers an empty refs listing", () => {
        chai.expect(localrepos.resolveLocalRepoRequest(repos, "owner/mono/refs")).deep.equals({ refs: {} });
    });

    it("answers the files of a nested package", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext/text") as pxt.Map<string>;
        chai.expect(Object.keys(files).sort()).deep.equals(["main.ts", "pxt.json", "test.ts"]);
        chai.expect(files["main.ts"]).contains("export const answer = 42;");
        chai.expect(JSON.parse(files["pxt.json"]).name).equals("ext");
    });

    it("answers the files of the root package", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "owner/mono/text") as pxt.Map<string>;
        chai.expect(Object.keys(files)).deep.equals(["pxt.json"]);
    });

    it("matches repositories case-insensitively", () => {
        const files = localrepos.resolveLocalRepoRequest(repos, "Owner/Mono/ext/text") as pxt.Map<string>;
        chai.expect(JSON.parse(files["pxt.json"]).name).equals("ext");
    });

    it("declines repositories that are not aliased, and logs it", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/other/text"), 404, "owner/other");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner"), 404, "owner");
        chai.expect(logger.errors.length).equals(2);
        chai.expect(logger.errors[0]).contains("owner/other/text");
    });

    it("fails with the missing path when an aliased repository has no package there, and logs it", () => {
        const missing = path.join(monoDir, "nothere", "pxt.json");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/nothere/text"), 404, missing);
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains(missing);
    });

    it("fails with the missing path when the request path runs through a file", () => {
        const missing = path.join(monoDir, "ext", "main.ts", "pxt.json");
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext/main.ts/text"), 404, missing);
    });

    it("rejects a request path that leads outside the repository, without reading there", () => {
        const extRepos = { "owner/ext": path.join(monoDir, "ext") };
        const outside = path.join(monoDir, "pxt.json");
        let err: any;
        try {
            localrepos.resolveLocalRepoRequest(extRepos, "owner/ext/../text");
        } catch (e) {
            err = e;
        }
        chai.expect(err, "expected an error").to.exist;
        chai.expect(err.statusCode).equals(400);
        chai.expect(err.message).contains("owner/ext/..");
        chai.expect(err.message).not.contains(outside);
        chai.expect(logger.errors).deep.equals([err.message]);
    });

    it("rejects a package that lists a file outside its directory", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/escaping/text"), 400, "../ext/main.ts");
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains(path.join(monoDir, "escaping", "pxt.json"));
    });

    it("fails with the missing file when a package lists a file that does not exist", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/incomplete/text"), 404,
            path.join(monoDir, "incomplete", "missing.ts"));
    });

    it("fails when a package's pxt.json is not valid", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/invalid/text"), 400,
            path.join(monoDir, "invalid", "pxt.json"));
    });

    it("rejects unknown requests, and logs it", () => {
        expectStatus(() => localrepos.resolveLocalRepoRequest(repos, "owner/mono/ext"), 400, "owner/mono/ext");
        chai.expect(logger.errors.length).equals(1);
        chai.expect(logger.errors[0]).contains("owner/mono/ext");
    });
});
