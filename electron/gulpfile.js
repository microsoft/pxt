"use strict";

// Increase max listeners for event emitters
require('events').EventEmitter.defaultMaxListeners = 100;

const assert = require("assert");
const cp = require("child_process");
const electronPackager = require("electron-packager");
const fs = require("fs");
const glob = require("glob");
const gulp = require("gulp");
const merge = require("merge-stream");
const path = require("path");
const replace = require('gulp-replace');
const rimraf = require("rimraf");
const tsb = require("gulp-tsb");

// Important paths
const srcRoot = path.join(__dirname, "src");
const tsconfigJsonPath = path.join(__dirname, "tsconfig.json");
const issPath = path.join(__dirname, "build", "win32", "pxt.iss");
const innoSetupPath = path.join(path.dirname(path.dirname(require.resolve('innosetup-compiler'))), 'bin', 'ISCC.exe');
let productJsonPath = null;
let targetRoot = null;
let outRoot = null;

// JSON data
const pkg = require(path.join(__dirname, "package.json"));
const tsConfig = require(tsconfigJsonPath).compilerOptions;
let product = null;

let compilation = tsb.create(tsConfig, /*verbose*/ true, /*json*/ false);

// Default task
gulp.task("default", ["compile"]);

// Cleaning tasks
gulp.task("clean", ["clean-js"]);
gulp.task("clean-all", ["clean-js"], cleanAll);
gulp.task("clean-js", cleanJsOutput);
gulp.task("clean-pkg", ["clean-pkg-win"]);
gulp.task("clean-pkg-win", () => cleanPackage("win32"));
gulp.task("clean-dist", ["clean-dist-win"]);
gulp.task("clean-dist-win", () => cleanDist("win32"));

// Compilation tasks
gulp.task("compile", compileTs);

// Packaging tasks
gulp.task("package", ["compile", "clean-pkg"], (cb) => { packageApp(process.platform, cb); });
gulp.task("package-all", ["package-win"]);
gulp.task("package-win", ["compile", "clean-pkg-win"], (cb) => { packageApp("win32", cb); });

// Distributing tasks
gulp.task("dist", ["clean-dist"], (cb) => { buildDistributable(process.platform, cb); });
gulp.task("dist-all", ["dist-win"]);
gulp.task("dist-win", ["clean-dist-win"], (cb) => { buildDistributable("win32", cb); });

// ----------
function getProduct() {
    if (!product) {
        if (!process.argv[3]) {
            throw new Error("This task requires the following args: --path/to/product.json");
        }

        productJsonPath = path.resolve(process.argv[3].replace(/^--/, ""));
        product = require(productJsonPath);
    }

    return product;
}

function getTargetRoot() {
    if (!targetRoot) {
        if (!process.argv[4]) {
            throw new Error("This task requires the following args: --path/to/product.json --path/to/root/of/target");
        }

        targetRoot = path.resolve(process.argv[4].replace(/^--/, ""));
    }

    return targetRoot;
}

function getOutRoot() {
    if (!outRoot) {
        outRoot = path.join(getTargetRoot(), "electron-out");
    }

    return outRoot;
}

function cleanJsOutput() {
    glob.sync("src/**/*.js", { ignore: "src/node_modules{,/**}" })
        .forEach(f => rimraf.sync(f));
}

function getPackagePath(platform) {
    return path.join(getOutRoot(), `${getProduct().applicationName}-${platform}-ia32`);
}

function getDistributablePath(platform) {
    const commonPath = path.join(getOutRoot(), `${getProduct().applicationName}-${platform}`);

    if (platform === "win32") {
        return commonPath + ".exe";
    }

    return commonPath + ".zip";
}

function cleanAll() {
    rimraf.sync(getOutRoot());
}

function cleanDist(platform) {
    const distToClean = getDistributablePath(platform);
    rimraf.sync(distToClean);
}

function cleanPackage(platform) {
    const packageToClean = getPackagePath(platform);
    rimraf.sync(packageToClean);
}

function compileTs() {
    const productInfo = getProduct();
    let tsSrc = gulp.src(["src/**/*.ts", "!src/node_modules{,/**}"])
        .pipe(replace(/@@(.*)@@/g, (match, p1) => {
            if (productInfo[p1]) {
                return productInfo[p1];
            } else {
                return match;
            }
        }))
        .pipe(compilation())
        .pipe(gulp.dest("src"));
    let productJson = gulp.src(productJsonPath)
        .pipe(gulp.dest("src"));

    return merge(tsSrc, productJson);
}

function packageApp(platform, cb) {
    if (platform !== "win32") {
        cb(new Error("ERROR: Not implemented yet"));
        return;
    }

    const productInfo = getProduct();
    let options = {
        arch: "ia32",
        dir: srcRoot,
        ignore: [
            /\.ts$/,
            /typings/,
            /node-pre-gyp/
        ],
        name: productInfo.nameShort,
        out: getOutRoot(),
        platform: platform,
        prune: false
    };

    if (productInfo.icons && productInfo.icons[platform]) {
        const iconPath = path.join(getTargetRoot(), productInfo.icons[platform]);

        if (fs.existsSync(iconPath)) {
            console.log("Using icon: " + iconPath);
            options.icon = iconPath;
        }
    }

    electronPackager(options, (err, apps) => {
        if (err) {
            return cb(err);
        }

        let renamedPackages = [];

        // Rename the packaged folder
        apps.forEach((a) => {
            const newName = a.replace(productInfo.nameShort, productInfo.applicationName);
            fs.renameSync(a, newName);
            renamedPackages.push(path.basename(newName));
        });

        console.log(`Packaged the following apps in ${path.basename(getOutRoot())}/:`);
        renamedPackages.forEach((app) => {
            console.log(`    ${app}`);
        });

        return cb();
    });
}

function buildDistributable(platform, cb) {
    switch (platform) {
        case "win32":
            buildWin32Setup(cb);
            break;
        default:
            zipPackage(platform, cb);
    }
}

function getTargetVersion() {
    const targetPkgJsonPath = path.join(__dirname, "..", "node_modules", getProduct().targetId, "package.json");

    try {
        const pkgJson = require(targetPkgJsonPath);
        return pkgJson.version;
    } catch (e) {
        return null;
    }
}

function buildWin32Setup(cb) {
    const win32Package = getPackagePath("win32");
    const productInfo = getProduct();

    if (!fs.existsSync(win32Package)) {
        cb(new Error("Packaged app missing, run 'gulp package-win' first"));
        return;
    }

    const version = getTargetVersion() || pkg.version;
    const exeName = path.basename(getDistributablePath("win32"));
    const installerBaseName = exeName.split(path.extname(exeName))[0];

    const definitions = {
        NameLong: productInfo.nameLong,
        NameShort: productInfo.nameShort,
        InstallerBaseName: installerBaseName,
        DistDir: getOutRoot(),
        DirName: productInfo.win32DirName,
        Version: version,
        RawVersion: version.replace(/-\w+$/, ""),
        NameVersion: productInfo.win32NameVersion,
        ExeBasename: productInfo.nameShort,
        RegValueName: productInfo.win32RegValueName,
        AppMutex: productInfo.win32MutexName,
        AppId: productInfo.win32AppId,
        AppUserId: productInfo.win32AppUserModelId,
        SourceDir: win32Package,
        RepoDir: __dirname
    };
    const keys = Object.keys(definitions);

    keys.forEach(key => assert(typeof definitions[key] === "string", `win32 setup: missing value for "${key}" in Inno Setup definitions`));

    const defs = keys.map(key => `/d${key}=${definitions[key]}`);
    const args = [issPath].concat(defs);

    cp.spawn(innoSetupPath, args, { stdio: "inherit" })
        .on("error", cb)
        .on("exit", () => cb(null));
}

function zipPackage(platform, cb) {
    // TODO
    cb(new Error("ERROR: Not implemented yet"));
}
