/*
 * Captures the CompileOptions environment needed to compile PXT programs to
 * native ARM Thumb entirely in-process, and writes it to
 * tests/thumb-test/fixtures/<name>.json.gz.
 *
 * Strategy: load the compiled pxt CLI bundle (built/pxt.js), monkey-patch
 * ts.pxtc.compile, then drive the CLI's own "build" command inside a scratch
 * project in the pxt-microbit checkout. The CLI assembles the full
 * CompileOptions -- including extinfo.hexinfo, which is the piece that native
 * compilation cannot proceed without -- and the patch intercepts it before any
 * code is emitted. The hex runtime comes from pxt-microbit/built/hexcache, so
 * no network and no C++ toolchain are involved.
 *
 * Usage:
 *   node tests/thumb-test/scripts/capture-fixture.js
 *
 * Environment:
 *   PXT_TARGET_DIR  target checkout to capture from
 *                   (default: sibling ../pxt-microbit)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const pxtDir = path.resolve(__dirname, "..", "..", "..");
const targetDir = path.resolve(
    process.env.PXT_TARGET_DIR || path.join(pxtDir, "..", "pxt-microbit"));
const variant = "mbcodal";
const fixtureName = "microbit-" + variant;
const fixturePath = path.join(
    pxtDir, "tests", "thumb-test", "fixtures", fixtureName + ".json.gz");
const projectDir = path.join(targetDir, "projects", "thumb-fixture");

// Fields of extinfo that are only needed by the C++ build service. They are
// large and never read by pxtc.compile.
const EXTINFO_DROP = ["compileData", "generatedFiles", "extensionFiles"];

function fail(msg) {
    console.error("capture-fixture: " + msg);
    process.exit(1);
}

function makeScratchProject() {
    // Stamping the current target version keeps the target's "upgrades" rules
    // from injecting extra dependencies (they are all gated on older versions).
    // Without the stamp the project reads as version 0.0.0, pxt-microbit's
    // missingPackage rules match it, and the build dies with an error like
    // "Package not installed: microphone".
    const targetVersion =
        JSON.parse(fs.readFileSync(path.join(targetDir, "package.json"), "utf8")).version;

    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "pxt.json"), JSON.stringify({
        name: "thumb-fixture",
        description: "Scratch project used to capture the thumb-test fixture.",
        dependencies: { core: "file:../../libs/core" },
        files: ["main.ts"],
        targetVersions: { target: targetVersion },
        supportedTargets: ["microbit"]
    }, null, 4) + "\n");
    // Deliberately trivial: the captured program text is replaced per test case.
    fs.writeFileSync(path.join(projectDir, "main.ts"), "let x = 1\n");
}

function stripOptions(opts) {
    const out = {
        target: opts.target,
        extinfo: opts.extinfo,
        fileSystem: opts.fileSystem,
        sourceFiles: opts.sourceFiles,
        jres: opts.jres,
        name: opts.name,
        bannedCategories: opts.bannedCategories,
        embedMeta: opts.embedMeta,
        embedBlob: opts.embedBlob,
        hexinfo: undefined
    };
    delete out.hexinfo;

    if (!out.extinfo || !out.extinfo.hexinfo || !out.extinfo.hexinfo.hex)
        fail("captured options have no extinfo.hexinfo -- native build did not " +
            "resolve a hex runtime (is built/hexcache populated?)");

    out.extinfo = Object.assign({}, out.extinfo);
    for (const k of EXTINFO_DROP)
        delete out.extinfo[k];

    // Other variants carry a second full hex image and are not exercised here.
    delete out.otherMultiVariants;

    return out;
}

function writeFixture(opts) {
    const captured = stripOptions(opts);
    const meta = {
        capturedAt: new Date().toISOString(),
        target: (global.pxt && global.pxt.appTarget && global.pxt.appTarget.id) || "unknown",
        targetVersion: (global.pxt && global.pxt.appTarget && global.pxt.appTarget.versions
            && global.pxt.appTarget.versions.target) || "unknown",
        variant: variant,
        sha: captured.extinfo.sha
    };
    const json = JSON.stringify({ meta: meta, options: captured });
    const gz = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, gz);

    console.log("");
    console.log("capture-fixture: wrote " + fixturePath);
    console.log("  raw json:   " + json.length + " bytes");
    console.log("  gzipped:    " + gz.length + " bytes (" +
        (gz.length / 1024 / 1024).toFixed(2) + " MB)");
    console.log("  sha:        " + meta.sha);
    console.log("  variant:    " + meta.variant);
    console.log("  hex lines:  " + captured.extinfo.hexinfo.hex.length);
    console.log("  fs entries: " + Object.keys(captured.fileSystem).length);
    console.log("  isNative:   " + captured.target.isNative +
        " nativeType=" + captured.target.nativeType);
}

function main() {
    if (!fs.existsSync(path.join(targetDir, "pxtarget.json")))
        fail("no pxtarget.json in " + targetDir + " (set PXT_TARGET_DIR)");
    if (!fs.existsSync(path.join(pxtDir, "built", "pxt.js")))
        fail("missing " + path.join(pxtDir, "built", "pxt.js") + " -- run npm run build first");

    makeScratchProject();
    process.chdir(projectDir);

    // Selects the V2/CODAL-only variant. This is a variant selector rather than
    // a real compile switch; see pxt.setCompileSwitch.
    process.env.PXT_COMPILE_SWITCHES = "csv---" + variant;

    const cli = require(path.join(pxtDir, "built", "pxt.js"));
    if (!cli || typeof cli.mainCli !== "function")
        fail("built/pxt.js did not export mainCli");

    const pxtc = global.ts.pxtc;
    const origCompile = pxtc.compile;
    let captured = false;

    pxtc.compile = function (opts) {
        if (!captured && opts && opts.target && opts.target.isNative) {
            captured = true;
            writeFixture(opts);
            // The emitted binary is of no interest; stop before the assembler runs.
            process.exit(0);
        }
        return origCompile.apply(this, arguments);
    };

    cli.mainCli(targetDir, ["build"]).then(() => {
        if (!captured)
            fail("build finished without a native compile -- nothing captured");
    }, err => {
        fail("build failed: " + (err && err.stack || err));
    });
}

main();
