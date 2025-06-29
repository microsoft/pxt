import { ErrorDisplayInfo } from "./errorList";
import { aiErrorExplainRequest } from "./cloud";

export interface ErrorExplanationStep {
    message: string; // The message to display
    elementId?: string; // The id of the element on the page to highlight
}

export interface ErrorHelpTourResponse {
    explanationSteps: ErrorExplanationStep[];
}

export type ErrorHelpExceptionType =
    | "featureDisabled"
    | "contentTooLarge"
    | "cannotParseResponse"
    | "throttled"
    | "emptyResponse"
    | "forbidden"
    | "unknown";

export class ErrorHelpException extends Error {
    errorType: ErrorHelpExceptionType;
    originalError?: Error;

    getUserFacingMessage(): string {
        switch (this.errorType) {
            case "featureDisabled":
                return lf("Feature not enabled for {0}.", pxt.appTarget.nickname || pxt.appTarget.name);
            case "contentTooLarge":
                return lf("Project too large");
            case "throttled":
                return lf("Too many requests. Please try again later.");
            case "forbidden":
                return lf("You don't have permission to use this feature.");
            case "cannotParseResponse":
            case "unknown":
            default:
                return lf("Something went wrong. Please try again later.");
        }
    }

    constructor(originalError: Error, errorType: ErrorHelpExceptionType) {
        super(originalError.message);

        this.errorType = errorType;
        this.originalError = originalError;
    }
}

/**
 * Converts the AI response data into our structured ErrorHelpResponse format.
 * This is used when the AI returns a JSON "tour" response.
 */
function parseTourResponse(response: string): ErrorHelpTourResponse {
    // The AI provides a JSON list with blockIds tied to explanations for each block, matching this format
    interface AiResponseJsonFormat {
        blockId: string;
        message: string;
    }

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
        throw new ErrorHelpException(new Error("Invalid response from AI"), "cannotParseResponse");
    }

    return { explanationSteps };
}

/**
 * Converts the list of errors into a string format for the AI to reference.
 * Adds block ids to the error message if they exist.
 */
function getErrorsAsText(errors: ErrorDisplayInfo[]): string {
    // Experimentally, converting to json is more token-heavy but leads to better results from the AI.
    // Providing more human-readable text often results in the AI walking through a stack instead of explaining root cause.
    // Prompt improvements may be able to help with this, but for now, use the json.
    return JSON.stringify(errors);
}

/**
 * Helper function to clean up code and remove unnecessary and bulky content.
 */
function cleanCodeForAI(code: string): string {
    // Remove any image content (it's bulky and not useful for the AI)
    let updatedCode = code.replace(/img`[^`]*`/g, "img`[trimmed for brevity]`");

    // Remove <mutation> tags (control things like block expansion, which is not useful for the AI)
    updatedCode = updatedCode.replace(/<mutation[^>]*>(.*?)<\/mutation>/g, "");

    return updatedCode;
}

/**
 * Sends a request to the AI service to get help with the provided code and errors.
 * Wraps exceptions in a custom ErrorHelpException.
 */
async function getHelpAsync(
    code: string,
    errors: ErrorDisplayInfo[],
    lang: "blocks" | "typescript" | "python",
    outputFormat: "tour_json" | "text"
): Promise<string> {
    const target = pxt.appTarget.nickname || pxt.appTarget.name;
    const cleanedCode = cleanCodeForAI(code);
    const errString = getErrorsAsText(errors);
    const locale = pxt.Util.userLanguage();
    const requestId = pxt.Util.guidGen();

    pxt.tickEvent("errorHelp.requestStart", {
        requestId,
        lang,
        outputFormat,
        errorCount: errors.length,
        errorSize: errString.length,
        codeSize: code.length,
        cleanedCodeSize: cleanedCode.length,
        locale
    });

    const startTime = Date.now();
    try {
        const response = await aiErrorExplainRequest(cleanedCode, errString, lang, target, outputFormat, locale);
        const endTime = Date.now();
        pxt.tickEvent("errorHelp.requestEnd", {
            requestId,
            success: "true",
            responseTimeMs: (endTime - startTime).toString(),
            responseSize: response?.length,
        });
        return response;
    } catch (e) {
        const endTime = Date.now();
        pxt.tickEvent("errorHelp.requestEnd", {
            requestId,
            success: "false",
            responseTimeMs: (endTime - startTime).toString(),
            statusCode: e.statusCode,
            error: e.message,
        });

        // Check status code to determine reason for error
        switch (e.statusCode) {
            case 403:
                throw new ErrorHelpException(e, "featureDisabled");
            case 401:
                throw new ErrorHelpException(e, "forbidden");
            case 413:
                throw new ErrorHelpException(e, "contentTooLarge");
            case 429:
                throw new ErrorHelpException(e, "throttled");
        }
        throw new ErrorHelpException(e, "unknown");
    }
}

/**
 * Get explanations for the given errors in a step-by-step format with specific points of interest.
 */
export async function getErrorHelpAsTour(
    errors: ErrorDisplayInfo[],
    lang: "blocks" | "typescript" | "python",
    code: string
): Promise<ErrorHelpTourResponse> {
    const response = await getHelpAsync(code, errors, lang, "tour_json");
    const parsedResponse = parseTourResponse(response);
    return parsedResponse;
}

/**
 * Get a simple, text-based explanation for the given errors.
 */
export async function getErrorHelpAsText(
    errors: ErrorDisplayInfo[],
    lang: "blocks" | "typescript" | "python",
    code: string
): Promise<string> {
    const response = await getHelpAsync(code, errors, lang, "text");
    const trimmedResponse = response?.trim();
    if (!trimmedResponse) {
        throw new ErrorHelpException(new Error("Empty response from AI"), "emptyResponse");
    }
    return trimmedResponse;
}
