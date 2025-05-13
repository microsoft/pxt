import { ErrorDisplayInfo } from "./errorList";
import { aiErrorExplainRequest } from "./cloud";

export interface ErrorExplanationStep {
    message: string; // The message to display
    elementId?: string; // The id of the element on the page to highlight
}

export interface ErrorHelpTourResponse {
    explanationSteps: ErrorExplanationStep[];
}

/**
 * Converts the AI response data into our structured ErrorHelpResponse format.
 * This is used when the AI returns a JSON "tour" response.
 */
function parseTourResponse(response: string): ErrorHelpTourResponse {
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

    console.log("AI response", response);

    // If the response contains markdown code "fencing" (i.e. ```json <my json> ```), remove it
    response = response.trim().replace(/^`{3,}(?:\w+)?\s*|`{3,}$/g, "");

    // Map response to internal format, keeping it distinct from the AI response structure
    // to insulate us from possible changes in the future.
    let explanationSteps: ErrorExplanationStep[] = [];
    const parsedResponse = pxt.Util.jsonTryParse(response) as AiResponseJsonFormat[];
    if (parsedResponse) {
        parsedResponse.forEach((item) => {
            const explanationStep: ErrorExplanationStep = {
                message: item.message,
                elementId: item.blockId,
            };
            explanationSteps.push(explanationStep);
        });
    } else {
        throw new Error("Invalid response from AI");
    }

    return { explanationSteps };
}

/**
 * Converts the list of errors into a string format for the AI to reference.
 * Adds block ids to the error message if they exist.
 */
function getErrorsAsText(errors: ErrorDisplayInfo[]): string {
    // TODO thsparks - json appears to be very token-heavy. Consider using a more readable format.
    return JSON.stringify(errors);
}


/**
 * Helper function to clean up code and remove unnecessary and bulky content.
 */
function cleanCodeForAI(code: string): string {
    // Remove any image content (it's bulky and not useful for the AI)
    const updatedCode = code.replace(/img`[^`]*`/g, "img`[trimmed for brevity]`");
    return updatedCode;
}

export async function getErrorHelpAsTour(
    errors: ErrorDisplayInfo[],
    lang: "blocks" | "typescript" | "python",
    code: string
): Promise<ErrorHelpTourResponse> {
    const target = pxt.appTarget.nickname || pxt.appTarget.name;
    const cleanedCode = cleanCodeForAI(code);
    console.log("Cleaned Code", cleanedCode);

    const errString = getErrorsAsText(errors);
    console.log("Errors", errString);

    // TODO thsparks : If error (incl. block ids) is same, check cached response. If ids in that are also valid, return cached response. Else, call API.

    // Call to backend API with code and errors, then set the explanation state
    // to the response from the backend
    const response = await aiErrorExplainRequest(cleanedCode, errString, lang, target, "tour_json");

    const parsedResponse = parseTourResponse(response);
    return parsedResponse;
}

export async function getErrorHelpAsText(
    errors: ErrorDisplayInfo[],
    lang: "blocks" | "typescript" | "python",
    code: string
): Promise<string> {
    const target = pxt.appTarget.nickname || pxt.appTarget.name;
    const cleanedCode = cleanCodeForAI(code);
    console.log("Cleaned Code", cleanedCode);

    const errString = getErrorsAsText(errors);
    console.log("Errors", errString);

    // TODO thsparks : If error (incl. block ids) is same, check cached response. If ids in that are also valid, return cached response. Else, call API.

    // Call to backend API with code and errors, then set the explanation state
    // to the response from the backend
    const response = await aiErrorExplainRequest(cleanedCode, errString, lang, target, "text");
    const trimmedResponse = response?.trim();

    if (!trimmedResponse) {
        throw new Error("Invalid response from AI");
    }

    return trimmedResponse;
}