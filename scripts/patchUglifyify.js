// This script patches this bug:
// https://github.com/hughsk/uglifyify/issues/88

const fs = require("fs");
const path = require("path");

// uglifyify is a dev dependency so it might not exist
if (!fs.existsSync(path.resolve("./node_modules/uglifyify/package.json"))) {
    return;
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