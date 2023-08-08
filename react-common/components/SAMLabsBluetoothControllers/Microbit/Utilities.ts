// @ts-nocheck
import ledPatterns from "./LEDPatterns";

const convertSvgToBase64 = (svgString) =>
    "data:image/svg+xml;base64," + window.btoa(svgString);

export const patternToSvg = (rows = []) => {
    const getUnlitLed = (row, col) =>
        `<rect width="10" height="20" rx="2" transform="translate(${3 + col * 46} ${
            2 + row * 44
        })" fill="#202020"/>`;

    const getLitLed = (row, col) =>
        `<rect width="14" height="24" rx="2" transform="translate(${1 + col * 46} ${
            1 + row * 44
        })" fill="#FF7F7F"/>`;

    return `
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#000"/>
            ${rows
        .map((row, rowIndex) =>
            row
                .map((col, colIndex) =>
                    col ? getLitLed(rowIndex, colIndex)
                        : getUnlitLed(rowIndex, colIndex)
                )
                .join("")
        )
        .join("")}
        </svg>
    `;
};

const patternToBase64 = (pattern) => convertSvgToBase64(patternToSvg(pattern));

export function getPatternOptions() {
    return ledPatterns.map((patternObject) => [
        patternToBase64(patternObject.array()),
        `'${patternObject.name}'`,
        patternObject.name,
    ]);
}
