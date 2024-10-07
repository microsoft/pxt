import * as Blockly from "blockly";

interface ExtendedGridOptions extends Blockly.Options.GridOptions {
    image?: {
        path: string;
        width: string;
        height: string;
        opacity: number;
    }
}

export function monkeyPatchGrid() {
    const options = pxt.appTarget.appTheme.blocklyOptions?.grid as ExtendedGridOptions;

    if (!options?.image?.path) return;

    const gridPatternIds: string[] = [];

    Blockly.Grid.createDom = function (rnd: string, gridOptions: Blockly.Options.GridOptions, defs: SVGElement) {
        const id = "blocklyGridPattern" + rnd;

        const gridPattern = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.PATTERN,
            {
                id,
                patternUnits: "userSpaceOnUse",
                width: options.image.width,
                height: options.image.height
            },
            defs,
        );

        gridPatternIds.push(id)

        const image = Blockly.utils.dom.createSvgElement(
            Blockly.utils.Svg.IMAGE,
            {
                width: options.image.width,
                height: options.image.height,
                opacity: options.image.opacity
            },
            gridPattern
        );

        image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", options.image.path)

        return gridPattern;
    }

    const oldGridUpdate = Blockly.Grid.prototype.update;

    Blockly.Grid.prototype.update = function (this: Blockly.Grid, scale: number) {
        oldGridUpdate.call(this, scale);

        const patternsToRemove: string[] = [];
        for (const patternId of gridPatternIds) {
            const imagePattern = document.getElementById(patternId) as unknown as SVGPatternElement;

            if (!imagePattern) {
                patternsToRemove.push(patternId);
                continue;
            }

            imagePattern.setAttribute("width", options.image.width);
            imagePattern.setAttribute("height", options.image.height);
        }

        for (const patternId of patternsToRemove) {
            gridPatternIds.splice(gridPatternIds.indexOf(patternId), 1);
        }
    }
}