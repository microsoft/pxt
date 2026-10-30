/*
 * Builds candidate and reference hexes for every hw-ab device project.
 *
 * The candidate is this checkout's compiler with no switches. The reference is
 * the same compiler with opt-out switches set, which is only meaningful when
 * the compiler actually implements them; see the identical-hash guard below.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const isWindows = process.platform === "win32";

const hwabDir = __dirname;
const pxtDir = path.resolve(hwabDir, "..", "..");
const targetSpec = process.env.PXT_TARGET_DIR || path.join(pxtDir, "..", "pxt-microbit");
const outDir = path.join(hwabDir, "out");

const USAGE = [
    "Usage: node tests/hw-ab/build-ab.js [options]",
    "",
    "Builds the hw-ab device projects twice -- once as the candidate (this",
    "checkout's compiler, no switches) and once as the reference -- and collects the",
    "hexes into tests/hw-ab/out/<case>/{candidate,reference}.hex.",
    "",
    "Options:",
    "  --ref-switches \"<list>\"  compile switches for the reference build; required",
    "                           when both sides build in one run. Name the opt-out",
    "                           switches of the codegen change under test -- there",
    "                           is no default, because a wrong or missing switch",
    "                           name silently builds a second candidate (see",
    "                           below).",
    "  --v2-only                build only the V2/CODAL variant, by adding the",
    "                           csv---mbcodal variant selector to BOTH builds",
    "  --candidate-only         build only the candidate",
    "  --reference-only         build only the reference; without --ref-switches",
    "                           this builds the current checkout as-is and files",
    "                           it under reference.hex (the git-based strategy)",
    "  -h, --help               this text",
    "",
    "Environment:",
    "  PXT_TARGET_DIR   target checkout (default: sibling ../pxt-microbit)",
    "",
    "Two reference strategies",
    "------------------------",
    "Switch-based (--ref-switches): one checkout, two builds, fast. It only",
    "works if the compiler on this branch implements the named opt-out switches.",
    "PXT parses PXT_COMPILE_SWITCHES name-agnostically, so an unknown switch is",
    "accepted silently and never read -- the \"reference\" is then byte-identical to",
    "the candidate for every case, which this script detects and fails on. Identical",
    "output for only some cases is normal (the switch gates a feature those programs",
    "do not use) and is reported as a note.",
    "",
    "It also only covers changes that are gated behind those switches. Any ungated",
    "change is present in both builds and invisible to the comparison.",
    "",
    "Git-based (gold standard): build the reference from a reference commit.",
    "",
    "    # reference side",
    "    git -C <pxt> checkout <reference-commit> && npm run build",
    "    node tests/hw-ab/build-ab.js --reference-only --v2-only",
    "",
    "    # candidate side",
    "    git -C <pxt> checkout <candidate-branch> && npm run build",
    "    node tests/hw-ab/build-ab.js --candidate-only --v2-only",
    "",
    "The two runs fill out/<case>/reference.hex and candidate.hex side by side;",
    "out/ is preserved between runs. That also means a stale hex from an earlier",
    "run will happily pair with a fresh one -- check sizes.txt if in doubt.",
    "",
    "Exit codes: 0 built, 1 usage or build error, 3 identical-hash guard tripped."
].join("\n");

function usage(stream) {
    stream.write(USAGE + "\n");
}

function fail(msg) {
    process.stderr.write("build-ab: " + msg + "\n");
    process.exit(1);
}

let refSwitches = "";
let v2Only = false;
let doCandidate = true;
let doReference = true;

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ref-switches") {
        if (i + 1 >= argv.length) fail("--ref-switches needs a value");
        refSwitches = argv[++i];
    } else if (arg === "--v2-only") {
        v2Only = true;
    } else if (arg === "--candidate-only") {
        doReference = false;
    } else if (arg === "--reference-only") {
        doCandidate = false;
    } else if (arg === "-h" || arg === "--help") {
        usage(process.stdout);
        process.exit(0);
    } else {
        usage(process.stderr);
        fail("unknown argument: " + arg);
    }
}

if (!doCandidate && !doReference)
    fail("--candidate-only and --reference-only are mutually exclusive");

// A switch-less reference is only a hazard when the candidate builds in the
// same run -- it would be a second candidate and the A/B would compare a
// build with itself. Reference-only with no switches is the git-based
// strategy: the current checkout IS the reference.
if (doReference && doCandidate && !refSwitches)
    fail("building both sides in one run needs --ref-switches \"<list>\" " +
        "naming the opt-out switches of the change under test, or use the " +
        "git-based strategy (--reference-only / --candidate-only per " +
        "checkout; see --help)");

let targetDir = "";
try {
    const resolved = fs.realpathSync(targetSpec);
    if (fs.statSync(resolved).isDirectory()) targetDir = resolved;
} catch (e) {
    targetDir = "";
}
if (!targetDir || !fs.existsSync(path.join(targetDir, "pxtarget.json")))
    fail("no pxtarget.json in '" + targetSpec + "' (set PXT_TARGET_DIR)");

// A PATH lookup, not a trial run: `pxt --version` exits nonzero when it is not
// invoked inside a target checkout, so its exit status cannot answer "is the
// CLI installed".
function onPath(cmd) {
    const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    const exts = isWindows
        ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
        : [""];
    for (const dir of dirs) {
        for (const ext of exts) {
            try {
                fs.accessSync(path.join(dir, cmd + ext), fs.constants.X_OK);
                return true;
            } catch (e) { /* keep looking */ }
        }
    }
    return false;
}

if (!onPath("pxt"))
    fail("no 'pxt' on PATH -- install the pxt CLI (npm i -g pxt)");
if (!fs.existsSync(path.join(pxtDir, "built", "pxt.js")))
    fail("missing " + path.join(pxtDir, "built", "pxt.js") +
        " -- run 'npm run build' in " + pxtDir + " first");

const projRoot = path.join(targetDir, "projects", "hw-ab");

function sha256(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

function pad(s, width) {
    return s.length >= width ? s : s + " ".repeat(width - s.length);
}

// The variant selector is not a compile switch; it picks the V2/CODAL-only
// build instead of the universal V1+V2 hex. It must be identical on both sides.
const variantSw = v2Only ? "csv---mbcodal" : "";

function joinSwitches(a, b) {
    return a && b ? a + "," + b : a + b;
}

process.stdout.write("build-ab: pxt      " + pxtDir + "\n");
process.stdout.write("build-ab: target   " + targetDir + "\n");
process.stdout.write("build-ab: variant  " + (variantSw || "<universal V1+V2>") + "\n");
process.stdout.write("build-ab: ref sw   " +
    (!doReference ? "<no reference build>" : refSwitches || "<none: checkout as-is>") + "\n");
process.stdout.write("\n");

const gen = spawnSync(process.execPath, [path.join(hwabDir, "gen-project.js")],
    { stdio: "inherit" });
if (gen.error) fail("could not run gen-project.js: " + gen.error.message);
if (gen.status !== 0) process.exit(gen.status === null ? 1 : gen.status);
const casesFile = path.join(projRoot, "cases.txt");
if (!fs.existsSync(casesFile)) fail("gen-project.js produced no cases.txt");
process.stdout.write("\n");

function buildOne(caseName, mode, switches) {
    const proj = path.join(projRoot, caseName);
    const dest = path.join(outDir, caseName, mode + ".hex");
    const logPath = path.join(outDir, caseName, mode + ".build.log");

    if (!fs.existsSync(proj)) fail("missing project " + proj);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // A stale built/ can hand back the previous mode's output.
    fs.rmSync(path.join(proj, "built"), { recursive: true, force: true });

    process.stdout.write("build-ab: " + pad(caseName, 22) + " " + pad(mode, 10) +
        " switches=" + (switches || "<none>") + "\n");
    const t0 = nowSeconds();

    const env = Object.assign({}, process.env);
    if (switches) env.PXT_COMPILE_SWITCHES = switches;
    else delete env.PXT_COMPILE_SWITCHES;

    // shell:true on Windows so the pxt.cmd shim resolves; the log fd is handed
    // to both stdout and stderr so the two interleave as they did on a console.
    const logFd = fs.openSync(logPath, "w");
    let res;
    try {
        res = spawnSync("pxt", ["build"], {
            cwd: proj,
            env: env,
            stdio: ["ignore", logFd, logFd],
            shell: isWindows
        });
    } finally {
        fs.closeSync(logFd);
    }

    if (res.error || res.status !== 0) {
        const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
        const lines = log.split("\n");
        if (lines.length && lines[lines.length - 1] === "") lines.pop();
        for (const line of lines) process.stderr.write("  | " + line + "\n");
        if (res.error) process.stderr.write("  | " + res.error.message + "\n");
        fail(caseName + "/" + mode + " build failed (log above)");
    }
    const t1 = nowSeconds();

    const binary = path.join(proj, "built", "binary.hex");
    if (!fs.existsSync(binary)) fail(caseName + "/" + mode + " built no binary.hex");
    fs.copyFileSync(binary, dest);
    process.stdout.write("build-ab:   -> " + dest + " (" +
        fs.statSync(dest).size + " bytes, " + (t1 - t0) + "s)\n");
}

fs.mkdirSync(outDir, { recursive: true });
const sizesFile = path.join(outDir, "sizes.txt");
fs.writeFileSync(sizesFile, [
    "# hw-ab build " + new Date().toISOString().replace(/\.[0-9]{3}Z$/, "Z"),
    "# variant: " + (variantSw || "universal"),
    "# reference switches: " + refSwitches,
    "# case mode bytes sha256",
    ""
].join("\n"));

const identical = [];
let pairs = 0;
const cases = fs.readFileSync(casesFile, "utf8").split("\n")
    .map(l => l.replace(/\r$/, ""))
    .filter(l => l.length > 0);

for (const caseName of cases) {
    fs.mkdirSync(path.join(outDir, caseName), { recursive: true });

    if (doCandidate) buildOne(caseName, "candidate", variantSw);
    if (doReference) buildOne(caseName, "reference", joinSwitches(variantSw, refSwitches));

    for (const mode of ["candidate", "reference"]) {
        const hex = path.join(outDir, caseName, mode + ".hex");
        if (!fs.existsSync(hex)) continue;
        fs.appendFileSync(sizesFile, caseName + " " + mode + " " +
            fs.statSync(hex).size + " " + sha256(hex) + "\n");
    }

    if (doCandidate && doReference) {
        pairs++;
        if (sha256(path.join(outDir, caseName, "candidate.hex")) ===
            sha256(path.join(outDir, caseName, "reference.hex"))) {
            identical.push(caseName);
        }
    }
    process.stdout.write("\n");
}

process.stdout.write("build-ab: sizes -> " + sizesFile + "\n");

// Some pairs identical is expected: a switch only changes the programs that use
// the feature it gates. Every pair identical is the failure mode worth catching
// -- the switch names buy nothing, so the A/B would compare a build with itself.
if (identical.length && identical.length === pairs) {
    process.stderr.write([
        "",
        "build-ab: ERROR -- candidate and reference hexes are byte-identical for every",
        "build-ab: case:",
        "build-ab:  " + identical.join(" "),
        "",
        "The reference build differs from the candidate only by the compile switches",
        "\"" + refSwitches + "\". Identical output everywhere means those switches changed",
        "nothing at all. The likely cause is that the compiler on this branch does not",
        "implement them: PXT_COMPILE_SWITCHES is parsed name-agnostically, so an",
        "unrecognised switch name is accepted silently and then never read, and the",
        "\"reference\" build is just a second candidate build.",
        "",
        "Check that the switch names are spelled as the compiler reads them, or use the",
        "git-based reference strategy instead (build-ab.js --help). An A/B run against",
        "an identical hex would compare a build with itself and always report \"same\".",
        ""
    ].join("\n"));
    process.exit(3);
}

for (const caseName of identical) {
    process.stdout.write("build-ab: note -- no codegen difference for " + caseName +
        " under these switches\n");
}

process.stdout.write("build-ab: done\n");
