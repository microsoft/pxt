const fs = require("fs");
const path = require("path");
const child_process = require("child_process");

const gulp = require("gulp");
const ts = require("gulp-typescript");
const merge = require("merge-stream");
const concat = require("gulp-concat");
const _rimraf = require("rimraf")

const clean = () => rimraf("built").then(() => rimraf("temp"));

const copyTypescriptServices = () => gulp.src("node_modules/typescript/lib/typescriptServices.d.ts")
    .pipe(gulp.dest("built"));

const pxtlib = () => compileTsProject("pxtlib");
const pxtcompiler = () => compileTsProject("pxtcompiler");
const pxtpy = () => compileTsProject("pxtpy");
const pxtsim = () => compileTsProject("pxtsim");
const pxtblocks = () => compileTsProject("pxtblocks");
const pxtwinrt = () => compileTsProject("pxtwinrt");
const pxtrunner = () => compileTsProject("pxtrunner");
const pxteditor = () => compileTsProject("pxteditor");
const backendutils = () => compileTsProject("backendutils")
const cli = () => compileTsProject("cli", "built", true);

const pxtblockly = () => gulp.src([
        "webapp/public/blockly/blockly_compressed.js",
        "webapp/public/blockly/blocks_compressed.js",
        "webapp/public/blockly/msg/js/en.js",
        "built/pxtblocks.js"
    ])
    .pipe(concat("pxtblockly.js"))
    .pipe(gulp.dest("built"));

const pxtjs = () => gulp.src([
        "node_modules/typescript/lib/typescript.js",
        "built/pxtlib.js",
        "built/pxtcompiler.js",
        "built/pxtpy.js",
        "built/pxtsim.js",
        "built/cli.js"
    ])
    .pipe(concat("pxt.js"))
    .pipe(gulp.dest("built"));



function updatestrings() {
    let errCnt = 0;
    const translationStrings = {}
    const translationHelpStrings = {}

    function processLf(filename) {
        if (!/\.(ts|tsx|html)$/.test(filename)) return
        if (/\.d\.ts$/.test(filename)) return

        //console.log('extracting strings from %s', filename);
        fs.readFileSync(filename, "utf8").split('\n').forEach((line, idx) => {
            function err(msg) {
                console.log("%s(%d): %s", filename, idx, msg);
                errCnt++;
            }

            while (true) {
                let newLine = line.replace(/\blf(_va)?\s*\(\s*(.*)/, (all, a, args) => {
                    let m = /^("([^"]|(\\"))+")\s*[\),]/.exec(args)
                    if (m) {
                        try {
                            let str = JSON.parse(m[1])
                            translationStrings[str] = 1
                        } catch (e) {
                            err("cannot JSON-parse " + m[1])
                        }
                    } else {
                        if (!/util\.ts$/.test(filename))
                            err("invalid format of lf() argument: " + args)
                    }
                    return "BLAH " + args
                })
                if (newLine == line) return;
                line = newLine
            }
        })
    }

    let fileCnt = 0;
    const paths = expand1(["pxtlib", "pxtblocks", "pxtblocks/fields", "webapp/src"]);
    paths.forEach(pth => {
        fileCnt++;
        processLf(pth);
    });

    Object.keys(translationHelpStrings).forEach(k => translationStrings[k] = k)
    let tr = Object.keys(translationStrings)
    tr.sort()

    if (!fs.existsSync("built")) fs.mkdirSync("built");
    fs.writeFileSync("built/localization.json", JSON.stringify({ strings: tr }, null, 1))
    let strings = {};
    tr.forEach((k) => { strings[k] = k; });
    fs.writeFileSync("built/strings.json", JSON.stringify(strings, null, 2));

    console.log("Localization extraction: " + fileCnt + " files; " + tr.length + " strings");
    if (errCnt > 0)
        console.log("%d errors", errCnt);

    return Promise.resolve();
}

const buildAll = gulp.series(
    copyTypescriptServices,
    pxtlib,
    gulp.parallel(pxtcompiler, pxtsim, backendutils),
    gulp.parallel(pxtpy, gulp.series(pxtblocks, pxtblockly)),
    pxteditor,
    gulp.parallel(pxtrunner, pxtwinrt, cli),
    pxtjs
);

exports.clean = clean;
exports.build = buildAll;
exports.default = buildAll;
exports.updatestrings = updatestrings;


function compileTsProject(dirname, destination, useOutdir) {
    if (!destination) destination = "built";
    let opts = useOutdir ? {
        outDir: path.resolve(destination)
    } : {
        out: path.resolve(destination, dirname + ".js")
    };

    let configPath = path.join(dirname, "tsconfig.json");
    let tsProject = ts.createProject(configPath, opts);
    let tsResult = tsProject.src()
        .pipe(tsProject());

    return merge(
        tsResult.js.pipe(gulp.dest(destination)),
        tsResult.dts.pipe(gulp.dest(destination))
    );
}

function rimraf(dirname) {
    return new Promise((resolve, reject) => {
        _rimraf(dirname, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function exec(command) {
    return new Promise((resolve, reject) => {
        child_process.exec(command, { encoding: "utf8"}, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

function expand1(dirs) {
    if (!Array.isArray(dirs))
        dirs = [dirs]
    let r = []
    dirs.forEach(dir =>
        fs.readdirSync(dir).forEach(f => r.push(dir + "/" + f)))
    return r
}