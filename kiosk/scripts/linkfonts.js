// This script is run from within the kiosk/ directory

const fs = require("fs");
const path = require("path");

const cssPath = path.resolve("./src/Fonts.css");
const css = `
@font-face {
    font-family: "Press Start 2P";
    src: url('fonts/Press_Start_2P/PressStart2P-Regular.ttf') format('truetype');
}

@font-face {
    font-family: "Share";
    src: url('fonts/Share/Share-Regular.ttf') format('truetype');
}`;

const linked = css.replace(/\s+src: url\('fonts\/([^']+)'\).*/mg, (match, relativePath) => {
    const fontPath = path.join(path.dirname(cssPath), "fonts", relativePath);
    const fontContents = fs.readFileSync(fontPath).toString("base64");

    console.log("Inlining fonts/" + relativePath)
    return `\n    src: url(data:application/font-ttf;charset=utf-8;base64,${fontContents}) format('truetype');`;
})

fs.writeFileSync(cssPath, linked);