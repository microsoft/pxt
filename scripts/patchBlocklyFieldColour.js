// This script patches Blockly's FieldColour plugin which has a typing
// error with the Blockly 12 beta. Presumably this plugin will receive
// an update when Blockly 12 is officially released and at that time
// this script can be removed.

const fs = require("fs");
const path = require("path");

if (!fs.existsSync(path.resolve("./node_modules/@blockly/field-colour/package.json"))) {
    return;
}

const packageJson = JSON.parse(fs.readFileSync(path.resolve("./node_modules/@blockly/field-colour/package.json"), "utf8"));

if (packageJson.version !== "5.0.12") {
    throw new Error("patchBlocklyFieldColour was written for @blockly/field-colour version 5.0.12. If the version has been updated, update or remove this script!");
}


function patchFile(filepath) {
    const contents = fs.readFileSync(filepath, "utf8");

    const patched = contents.replace(
        "protected isFullBlockField(): boolean",
        "public    isFullBlockField(): boolean"
    );

    fs.writeFileSync(filepath, patched, "utf8");
}

patchFile(path.resolve(__dirname, "..", "./node_modules/@blockly/field-colour/dist/field_colour.d.ts"));
patchFile(path.resolve(__dirname, "..", "./node_modules/@blockly/field-colour/src/field_colour.ts"));

console.log("Patched @blockly/field-colour")