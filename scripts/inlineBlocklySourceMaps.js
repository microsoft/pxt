const fs = require("fs");
const path = require("path");

const blocklyRoot = path.resolve(__dirname, "..", "node_modules", "blockly");

const files = [
    "blockly_compressed.js",
    "blocks_compressed.js"
];

for (const file of files) {
    const fullPath = path.join(blocklyRoot, file);
    const source = fs.readFileSync(fullPath, "utf8");
    const maps = fs.readFileSync(fullPath + ".map", "utf8");

    const dataUri = "data:application/json;charset=utf-8;base64," + Buffer.from(maps).toString("base64");

    const patched = source.replace(/\/\/# sourceMappingURL=.*/, `//# sourceMappingURL=${dataUri}`);

    fs.writeFileSync(fullPath, patched, "utf8");
}