export interface querySelector {
    targetQuery: string;
    sansQuery?: string;
    sansLocation?: pxt.tour.BubbleLocation;
}

function getTargetMap(target: string): querySelector {
    const targetMap: pxt.Map<querySelector> = {
        "simulator": {
            targetQuery: "#boardview",
        },
        "toolbox": {
            targetQuery: ".blocklyToolboxDiv",
        },
        "monaco toolbox": {
            targetQuery: ".monacoToolboxDiv",
        },
        "workspace": {
            targetQuery: "#blocksEditor", // includes the toolbox
            sansQuery: ".blocklyToolboxDiv",
            sansLocation: pxt.tour.BubbleLocation.Left
        },
        "monaco workspace": {
            targetQuery: "#monacoEditorRightArea",
        },
        "share": {
            targetQuery: ".shareproject",
        },
        "download": {
            targetQuery: "#downloadArea",
        },
        "play button" : {
            targetQuery: ".big-play-button",
        },
        "everything" : {
            targetQuery: "#root",
        },
        "nothing" : {
            targetQuery: "nothing",
        }
    }
    return targetMap[target];
}

export async function loadTourStepsAsync(name: string): Promise<pxt.MarkdownSection[]> {
    const md = await pxt.Cloud.markdownAsync(name);
    return pxt.getSectionsFromMarkdownMetadata(md);
}

export async function parseTourStepsAsync(name: string): Promise<pxt.tour.BubbleStep[]> {
    const EditorContent: pxt.tour.BubbleStep[] = [];
    const tourSteps = await loadTourStepsAsync(name);
    for (const step of tourSteps) {
        if (step.headerKind === "double" && step.attributes && step.attributes.title && step.attributes.description && step.attributes.location && step.attributes.highlight) {
            const title = step.attributes.title;
            const description = step.attributes.description;
            let location = getLocation(step.attributes.location.toLowerCase());
            let querySelector = getTargetMap(step.attributes.highlight.toLowerCase());
            if (!querySelector) {
                querySelector = { targetQuery: "#root" };
                location = pxt.tour.BubbleLocation.Center;
                console.log(`Tour steps: "${step.attributes.highlight}" is not a valid element to highlight!`);
            } else if (querySelector.targetQuery !== "nothing") {   // check that element is visible before adding to tour
                const target = document.querySelector(querySelector.targetQuery) as HTMLElement;
                if (!target || target.offsetParent === null || window.getComputedStyle(target).display === "none") continue;
            }
            const targetQuery = querySelector.targetQuery;
            const sansQuery = querySelector.sansQuery ?? undefined;
            const sansLocation = querySelector.sansLocation ?? undefined;
            const targetContent: pxt.tour.BubbleStep = { title, description, location, targetQuery, sansQuery, sansLocation };
            EditorContent.push(targetContent);
        }
    }
    return EditorContent;
}

export function getLocation(location: string): pxt.tour.BubbleLocation {
    switch (location) {
        case "above":
            return pxt.tour.BubbleLocation.Above;
        case "below":
            return pxt.tour.BubbleLocation.Below;
        case "left":
            return pxt.tour.BubbleLocation.Left;
        case "right":
            return pxt.tour.BubbleLocation.Right;
        case "center":
        default:
            return pxt.tour.BubbleLocation.Center;
    }
}