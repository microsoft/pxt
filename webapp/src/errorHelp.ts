import * as pkg from "./package";
import { Editor } from "./blocks";
import { ErrorDisplayInfo } from "./errorList";
import { aiErrorExplainRequest } from "./cloud";

export interface ErrorExplanationStep {
    message: string; // The message to display
    elementId?: string; // The id of the element on the page to highlight
    onStepBegin?: () => void;
}

export interface ErrorHelpResponse {
    explanationSteps: ErrorExplanationStep[];
}

/**
 * Converts the AI response data into our structured ErrorHelpResponse format.
 * This is used when the AI returns a JSON "tour" response.
 */
function parseTourResponse(parent: pxt.editor.IProjectView, response: string): ErrorHelpResponse {
    /*
    The AI either provides a JSON list with blockIds tied to explanations for each block.
    For example:
    [
        {
            "blockId": "sampleblockid",
            "message": "Here is a helpful message walking you through the error. This one will be displayed first."
        },
        {
            "blockId": "sampleblockid2",
            "message": "Here is another helpful message walking you through the error. This one will be displayed second."
        }
    ]
    */
    interface AiResponseJsonFormat {
        blockId: string;
        message: string;
    }

    let explanationSteps: ErrorExplanationStep[] = [];

    console.log("AI response", response);

    // If the response contains markdown code "fencing" (i.e. ```json <my json> ```), remove it
    response = response.trim().replace(/^`{3,}(?:\w+)?\s*|`{3,}$/g, "");

    const parsedResponse = pxt.Util.jsonTryParse(response) as AiResponseJsonFormat[];

    if (parsedResponse) {
        // TODO thsparks - Can we move "validation" of a response up to the parent editor?
        const validBlockIds = parent.getBlocks().map((b) => b.id);
        for (const item of parsedResponse) {
            const step: ErrorExplanationStep = {
                message: item.message,
            };

            // Check each blockId is specified & valid, and if so, add a tour step for it
            const blockId = item.blockId;
            if (blockId) {
                if (validBlockIds.includes(blockId)) {
                    step.elementId = `g[data-id="${blockId}"]`;
                    step.onStepBegin = () => {
                        (parent.editor as Editor).editor.centerOnBlock(blockId);
                    };
                } else {
                    // TODO thsparks - Maybe?
                    // Try to repair the block id. The AI sometimes sends variable ids instead of blockIds.
                    // If that variable id is only used in one block, we can assume that is the block we should point to.
                    // https://developers.google.com/blockly/reference/js/blockly.workspace_class.getvariableusesbyid_1_method#workspacegetvariableusesbyid_method

                    pxt.error(`Invalid blockId in AI response`, blockId, parsedResponse);
                }
            }

            explanationSteps.push(step);
        }
    } else {
        // TODO thsparks - handle error properly
        throw new Error("Invalid response from AI");
    }

    return { explanationSteps };
}

/**
 * Converts the AI response data into our structured ErrorHelpResponse format.
 * This is used when the AI returns a simple text response.
 */
function parseTextResponse(response: string): ErrorHelpResponse {
    return {
        explanationSteps: [
            {
                message: response,
            },
        ],
    };
}

/**
 * Converts the list of errors into a string format for the AI to reference.
 * Adds block ids to the error message if they exist.
 */
function getErrorsAsText(errors: ErrorDisplayInfo[]): string {
    return JSON.stringify(errors);
}

/**
 * Cleans up blocks code to remove unnecessary and bulky content.
 */
function cleanBlocksCode(code: string): string {
    // Remove any image content (it's bulky and not useful for the AI)
    const updatedCode = code.replace(/img`[^`]*`/g, "img`[trimmed for brevity]`");
    return updatedCode;
}

/**
 * Calls the AI-Error-Help API to get assistance with the provided errors.
 */
export async function getHelpAsync(
    parent: pxt.editor.IProjectView,
    errors: ErrorDisplayInfo[]
): Promise<ErrorHelpResponse> {
    const lang = parent.isBlocksActive() ? "blocks" : "typescript";
    const target = pxt.appTarget.nickname || pxt.appTarget.name;
    const mainPkg = pkg.mainEditorPkg();
    const code =
        (parent.isBlocksActive()
            ? cleanBlocksCode((parent.editor as Editor).getWorkspaceXmlWithIds())
            : mainPkg.files[pxt.MAIN_TS]?.content) ?? "";
    const outputFormat = parent.isBlocksActive() ? "tour_json" : "text";
    console.log("Code", code);

    const errString = getErrorsAsText(errors);
    console.log("Errors", errString);

    // TODO thsparks : If error (incl. block ids) is same, check cached response. If ids in that are also valid, return cached response. Else, call API.

    // Call to backend API with code and errors, then set the explanation state
    // to the response from the backend
    const response = await aiErrorExplainRequest(code, errString, lang, target, outputFormat);

    const parsedResponse =
        outputFormat == "tour_json" ? parseTourResponse(parent, response) : parseTextResponse(response);
    return parsedResponse;
}
