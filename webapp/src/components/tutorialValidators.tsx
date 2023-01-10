import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;
import IProjectView = pxt.editor.IProjectView;
import * as compiler from "../compiler";
import { MarkedContent } from "../marked";

export type TutorialValidationResult = {
    isValid: Boolean;
    hint: string | JSX.Element;
};

const defaultResult: TutorialValidationResult = {
    isValid: true,
    hint: null,
};

export abstract class TutorialValidator {
    enabled: boolean = false;

    execute(parent: IProjectView, tutorialOptions: TutorialOptions): Promise<TutorialValidationResult> {
        if (!this.enabled) return Promise.resolve(defaultResult);

        return this.executeInternal(parent, tutorialOptions);
    }

    protected abstract executeInternal(parent: IProjectView, tutorialOptions: TutorialOptions): Promise<TutorialValidationResult>;
}

export class BlocksExistValidator extends TutorialValidator {
    private useHintHighlight = false;

    useHintHighlightBlocks() {
        this.enabled = true;
        this.useHintHighlight = true;
    }

    async executeInternal(parent: IProjectView, tutorialOptions: TutorialOptions): Promise<TutorialValidationResult> {

        let missingBlocks: string[] = [];
        const stepInfo = tutorialOptions.tutorialStepInfo
            ? tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep]
            : null;
        if (!stepInfo) return { isValid: true, hint: "" };

        // TODO thsparks : If not supporting custom blocks to check, can remove useHintHighlight for now. Otherwise allow for custom block ids.
        if (this.useHintHighlight) {

            // TODO thsparks : Confirm loaded before accessing?
            const userBlocks = Blockly.getMainWorkspace().getAllBlocks(false /* ordered */);
            const userBlocksByType: Set<string> = new Set<string>(userBlocks.map((b) => b.type));

            const allHighlightedBlocks = await getTutorialHighlightedBlocks(tutorialOptions, stepInfo);
            if(!allHighlightedBlocks) {
                return defaultResult;
            }

            const stepHash = getTutorialStepHash(tutorialOptions);
            const stepHighlights = allHighlightedBlocks[stepHash];
            const highlightedBlockKeys = stepHighlights ? Object.keys(stepHighlights) : [];

            for (let i: number = 0; i < highlightedBlockKeys.length; i++) {
                let tutorialBlockKey = highlightedBlockKeys[i];
                if (!userBlocksByType.has(tutorialBlockKey)) {
                    // user did not use a specific block
                    missingBlocks.push(tutorialBlockKey);
                }
            }
        }

        const isValid = missingBlocks.length == 0;

        // TODO thsparks : Revisit showing individual blocks if time permits.
        /*
        const blockImageUris = isValid ? [] : await getBlockImageUris(missingBlocks);
        const blockImages = (
            <div>
                <p>{lf("Double check your workspace to make sure these blocks are inside and connected to the rest of your code:")}</p>
                {blockImageUris.filter(b => !!b).map((blockUri, index) => <img key={index + blockUri} src={blockUri} alt={lf("missing block")} />)}
            </div>);
        */

        const blockImages = stepInfo?.hintContentMd ? (<div>
            <strong>{lf("Looks like you're missing some blocks.")}</strong>
            <p>{lf("Make sure you see blocks that look like this and that they're connected to the rest of your code.")}</p>
            <MarkedContent className="no-select" markdown={stepInfo.hintContentMd} parent={parent} />
        </div>) : "";

        return {
            isValid: isValid,
            hint: isValid ? undefined : blockImages,
        }
    }
}

function getTutorialHighlightedBlocks(tutorial: TutorialOptions, step: TutorialStepInfo): Promise<pxt.Map<pxt.Map<number>> | undefined> {
    return pxt.BrowserUtils.tutorialInfoDbAsync().then((db) =>
        db.getAsync(tutorial.tutorial, tutorial.tutorialCode).then((entry) => {
            if (entry?.highlightBlocks) {
                return Promise.resolve(entry.highlightBlocks);
            } else {
                return Promise.resolve(undefined);
            }
        })
    );
}

function getTutorialStepHash(tutorial: TutorialOptions): string {
    const { tutorialStepInfo, tutorialStep } = tutorial;
    const body = tutorialStepInfo[tutorialStep].hintContentMd;
    let hintCode = "";
    if (body != undefined) {
        body.replace(/((?!.)\s)+/g, "\n")
            .replace(
                /``` *(block|blocks)\s*\n([\s\S]*?)\n```/gim,
                function (m0, m1, m2) {
                    hintCode = `{\n${m2}\n}`;
                    return "";
                }
            );
    }

    return pxt.BrowserUtils.getTutorialCodeHash([hintCode]);
}

// TODO thsparks : Revisit if time permits.
// TODO thsparks : Reduce duplication from tutorialCodeValidation.
/*
async function getBlockImageUris(blockIds: string[]): Promise<string[]> {
    // Get all APIs from compiler
    return compiler.getBlocksAsync().then(blocksInfo => {
        return Promise.all(blockIds.map(id => {
            // TODO thsparks - cache? - if (this.renderedBlockCache[id]) return Promise.resolve(this.renderedBlockCache[id]);

            const symbol = blocksInfo.blocksById[id];
            if (!symbol) return Promise.resolve(undefined);

            // Render toolbox block from symbol info
            const fn = pxt.blocks.blockSymbol(id);
            if (fn) {
                const comp = pxt.blocks.compileInfo(fn);
                const blockXml = pxt.blocks.createToolboxBlock(blocksInfo, fn, comp);
                const svg = pxt.blocks.render(`<xml xmlns="https://developers.google.com/blockly/xml">${blockXml.outerHTML}</xml>`,
                    { snippetMode: true, splitSvg: false }) as SVGSVGElement;
                const viewBox = svg.getAttribute("viewBox").split(/\s+/).map(d => parseInt(d));
                return pxt.blocks.layout.blocklyToSvgAsync(svg, viewBox[0], viewBox[1], viewBox[2], viewBox[3])
                    .then(sg => {
                        if (!sg) return Promise.resolve<string>(undefined);
                        return pxt.BrowserUtils.encodeToPngAsync(sg.xml, { width: sg.width, height: sg.height, pixelDensity: 1 });
                    })
            }

            return Promise.resolve(undefined)
        }));
    })
}
*/