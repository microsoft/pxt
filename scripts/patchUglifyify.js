// This script patches this bug:
// https://github.com/hughsk/uglifyify/issues/88

const fs = require("fs");
const path = require("path");

if (!fs.existsSync(path.resolve("./node_modules/uglifyify/package.json"))) {
    throw new Error("Uglifyify not found! Run this script from the root of the repo and make sure you ran npm install");
}

const packageJson = JSON.parse(fs.readFileSync(path.resolve("./node_modules/uglifyify/package.json"), "utf8"));

if (packageJson.version !== "5.0.2") {
    throw new Error("patchUglifyify was written for version 5.0.2. If the version has been updated, update the script!");
}

const index = fs.readFileSync(path.resolve("./node_modules/uglifyify/index.js"), "utf8");

const lines = index.split("\n");
lines.splice(38, 0, "  delete opts.ignore;");

fs.writeFileSync(path.resolve("./node_modules/uglifyify/index.js"), lines.join("\n"), "utf8");

console.log("Patched uglifyify")