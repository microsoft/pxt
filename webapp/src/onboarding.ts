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
        "workspace": {
            targetQuery: "#blocksEditor", // includes the toolbox
            sansQuery: ".blocklyToolboxDiv",
            sansLocation: pxt.tour.BubbleLocation.Left
        },
        "share": {
            targetQuery: ".shareproject",
        },
        "download": {
            targetQuery: "#downloadArea",
        },
        "everything" : {
            targetQuery: "#root",
        }
    }
    return targetMap[target];
}

export async function loadTourStepsAsync(name: string): Promise<pxt.MarkdownSection[]> {
    return pxt.Cloud.markdownAsync(name)
        .then(md => pxt.getSectionsFromMarkdownMetadata(md));
}

export async function parseTourStepsAsync(name: string): Promise<pxt.tour.BubbleStep[]> {
    const EditorContent: pxt.tour.BubbleStep[] = [];
    const tourSteps = await loadTourStepsAsync(name);
    for (const step of tourSteps) {
        if (step.headerKind === "double" && step.attributes && step.attributes.title && step.attributes.description && step.attributes.location && step.attributes.highlight) {
            const title = step.attributes.title;
            const description = step.attributes.description;
            const location = getLocation(step.attributes.location);
            const querySelector = getTargetMap(step.attributes.highlight.toLowerCase());
            const targetQuery = querySelector.targetQuery ?? undefined;
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