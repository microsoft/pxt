import * as pkg from "./package";
import { Editor } from "./blocks";
import { ErrorDisplayInfo } from "./errorList";
import { aiErrorExplainRequest } from "./cloud";

export interface ErrorHelpResponse {
    explanationAsText: string;
    explanationAsTour: pxt.tour.BubbleStep[];
}

export class ErrorHelper {

    parent: pxt.editor.IProjectView;
    constructor(parent: pxt.editor.IProjectView) {
        this.parent = parent;
    }

    protected parseResponse(response: string): ErrorHelpResponse {
        // We ask the AI to provide an ordered JSON list with blockIds tied to explanations for each block.
        // For example:
        // [
        //     {
        //         "blockId": "sampleblockid",
        //         "message": "Here is a helpful message walking you through the error. This one will be displayed first."
        //     },
        //     {
        //         "blockId": "sampleblockid2",
        //         "message": "Here is another helpful message walking you through the error. This one will be displayed second."
        //     }
        // ]
        interface AiResponseJsonFormat {
            blockId: string;
            message: string;
        }

        let explanationAsText = "";
        let explanationAsTour: pxt.tour.BubbleStep[] = [];

        console.log("AI response", response);

        // If the response contains markdown code "fencing" (i.e. ```json <my json> ```), remove it
        response = response.trim().replace(/^`{3,}(?:\w+)?\s*|`{3,}$/g, "");

        const parsedResponse = pxt.Util.jsonTryParse(
            response
        ) as AiResponseJsonFormat[];
        if (parsedResponse) {
            const validBlockIds = this.parent.getBlocks().map((b) => b.id);
            for (const item of parsedResponse) {
                const tourStep = {
                    title: lf("Error Explanation"),
                    description: item.message,
                    location: pxt.tour.BubbleLocation.Center
                } as pxt.tour.BubbleStep;

                // Check each blockId is specified & valid, and if so, add a tour step for it
                const blockId = item.blockId;
                if (blockId) {
                    if (validBlockIds.includes(blockId)) {
                        tourStep.targetQuery = `g[data-id="${blockId}"]`;
                        tourStep.location = pxt.tour.BubbleLocation.Right;
                        tourStep.onStepBegin = () => {
                            (this.parent.editor as Editor).editor.centerOnBlock(blockId);
                        }
                    } else {
                        // TODO - handle this case
                        console.error("Invalid blockId in AI response", blockId, parsedResponse, response);
                    }
                }

                explanationAsTour.push(tourStep);
            }
        } else {
            explanationAsText = response; // TODO - handle this case better
        }

        return {
            explanationAsText,
            explanationAsTour:
                explanationAsTour.length > 0 ? explanationAsTour : undefined,
        };
    }

    /**
     * Converts the list of errors into a string format for the AI to reference.
     * Adds block ids to the error message if they exist.
     */
    protected getErrorsAsText(errors: ErrorDisplayInfo[]): string {
        return JSON.stringify(errors);
    }

    protected cleanBlocksCode(code: string): string {
        // Remove any image content (it's bulky and not useful for the AI)
        const updatedCode = code.replace(/img`[^`]*`/g, "img`[trimmed for brevity]`");
        return updatedCode;
    }

    async getHelpAsync(errors: ErrorDisplayInfo[]): Promise<ErrorHelpResponse> {
        const lang = this.parent.isBlocksActive() ? "blocks" : "typescript";
        const target = pxt.appTarget.nickname || pxt.appTarget.name;
        const mainPkg = pkg.mainEditorPkg();
        const code = (this.parent.isBlocksActive() ? this.cleanBlocksCode((this.parent.editor as Editor).getWorkspaceXmlWithIds()) : mainPkg.files[pxt.MAIN_TS]?.content) ?? "";
        const outputFormat = this.parent.isBlocksActive() ? "tour_json" : "text";
        console.log("Code", code);

        const errString = this.getErrorsAsText(errors);
        console.log("Errors", errString);

        // Call to backend API with code and errors, then set the explanation state
        // to the response from the backend
        const response = await aiErrorExplainRequest(
            code,
            errString,
            lang,
            target,
            outputFormat
        );

        const parsedResponse = this.parseResponse(response);
        return parsedResponse;
    }
}
