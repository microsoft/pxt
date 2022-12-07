import TutorialOptions = pxt.tutorial.TutorialOptions;
import TutorialStepInfo = pxt.tutorial.TutorialStepInfo;
import IProjectView = pxt.editor.IProjectView;
import * as compiler from "../compiler";

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
    private hintBlocks = false;

    checkHintBlocks() {
        this.enabled = true;
        this.hintBlocks = true;
    }

    async executeInternal(parent: IProjectView, tutorialOptions: TutorialOptions): Promise<TutorialValidationResult> {

        let missingBlocks: string[] = [];

        if (this.hintBlocks) {
            const stepInfo = tutorialOptions.tutorialStepInfo
                ? tutorialOptions.tutorialStepInfo[tutorialOptions.tutorialStep]
                : null;
            if (!stepInfo) return { isValid: true, hint: "" };

            // TODO thsparks : Confirm loaded before accessing?
            const userBlocks = Blockly.getMainWorkspace().getAllBlocks(false /* ordered */);
            const userBlocksByType: Set<string> = new Set<string>(userBlocks.map((b) => b.type));

            const indexdb = await tutorialBlockList(tutorialOptions, stepInfo);
            const tutorialBlocks = extractBlockSnippet(tutorialOptions, indexdb);
            const tutorialBlockKeys = Object.keys(tutorialBlocks ?? {});

            for (let i: number = 0; i < tutorialBlockKeys.length; i++) {
                let tutorialBlockKey = tutorialBlockKeys[i];
                if (!userBlocksByType.has(tutorialBlockKey)) {
                    // user did not use a specific block
                    missingBlocks.push(tutorialBlockKey);
                }
            }
        }

        const isValid = missingBlocks.length == 0;
        const blockImageUris = isValid ? [] : await getBlockImageUris(missingBlocks);
        const blockImages = (
            <div>
                <p>We expected to see these blocks in your workspace, but couldn't find them:</p>
                {blockImageUris.filter(b => !!b).map((blockUri, index) => <img key={index + blockUri} src={blockUri} alt="block rendered" />)}
            </div>);

        return {
            isValid: isValid,
            hint: isValid ? undefined : blockImages,
        }
    }
}

// TODO thsparks: Understand, comment, reduce duplication with old validation
function tutorialBlockList(tutorial: TutorialOptions, step: TutorialStepInfo): Promise<pxt.Map<pxt.Map<number>> | undefined> {
    return pxt.BrowserUtils.tutorialInfoDbAsync().then((db) =>
        db.getAsync(tutorial.tutorial, tutorial.tutorialCode).then((entry) => {
            if (entry?.snippets) {
                return Promise.resolve(entry.snippets);
            } else {
                return Promise.resolve(undefined);
            }
        })
    );
}

// TODO thsparks: Understand, comment, reduce duplication with old validation
function extractBlockSnippet(tutorial: TutorialOptions, indexdb: pxt.Map<pxt.Map<number>>) {
    const { tutorialStepInfo, tutorialStep } = tutorial;
    const body = tutorial.tutorialStepInfo[tutorialStep].hintContentMd;
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

    const snippetStepKey = pxt.BrowserUtils.getTutorialCodeHash([hintCode]);
    let blockMap = {};
    if (indexdb != undefined) {
        blockMap = indexdb[snippetStepKey];
    }
    return blockMap;
}

// TODO thsparks : Reduce duplication from tutorialCodeValidation.
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
