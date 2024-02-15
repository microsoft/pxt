/// <reference path="../../../localtypings/validatorPlan.d.ts" />

import { ErrorCode } from "../types/errorCode";
import { logDebug, logError } from "./loggingService";
import * as AutorunService from "./autorunService";

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
let readyForMessages: boolean;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: { [index: string]: PendingMessage } = {};

function onMessageReceived(event: MessageEvent) {
    logDebug(`Message received from iframe: ${JSON.stringify(event.data)}`);

    const data = event.data as pxt.editor.EditorMessageRequest;
    if (data.type === "pxteditor") {
        if (data.action === "editorcontentloaded") {
            readyForMessages = true;
            sendMessageAsync(); // flush message queue.
            AutorunService.poke();
        }

        if (data.id && pendingMessages[data.id]) {
            const pending = pendingMessages[data.id];
            pending.handler(data);
            delete pendingMessages[data.id];
        }
    }
}

function sendMessageAsync(message?: any) {
    return new Promise(resolve => {
        const sendMessageCore = (message: any) => {
            logDebug(`Sending message to iframe: ${JSON.stringify(message)}`);
            makecodeEditorRef!.contentWindow!.postMessage(message, "*");
        };

        if (message) {
            message.response = true;
            message.id = nextId++ + "";
            pendingMessages[message.id] = {
                original: message,
                handler: resolve,
            };
            messageQueue.push(message);
        }
        if (readyForMessages) {
            while (messageQueue.length) {
                sendMessageCore(messageQueue.shift());
            }
        }
    });
}

// Check if the result was successful and (if expected) has data.
// Logs errors and throws if the result was not successful.
function validateResponse(result: pxt.editor.EditorMessageResponse, expectResponseData: boolean) {
    if (!result.success) {
        throw new Error(`Server returned failed status.`);
    }
    if (expectResponseData && !result?.resp) {
        throw new Error(`Missing response data.`);
    }
}

export function clearReady() {
    readyForMessages = false;
}

export function setEditorRef(ref: HTMLIFrameElement | undefined) {
    makecodeEditorRef = ref ?? undefined;
    window.removeEventListener("message", onMessageReceived);
    if (ref) {
        window.addEventListener("message", onMessageReceived);
    }
}

//  an example of events that we want to/can send to the editor
export async function setHighContrastAsync(on: boolean) {
    const result = await sendMessageAsync({
        type: "pxteditor",
        action: "sethighcontrast",
        on: on,
    });
    console.log(result);
}

export async function runValidatorPlanAsync(
    validatorPlan: pxt.blocks.ValidatorPlan,
    planLib: pxt.blocks.ValidatorPlan[]
): Promise<pxt.blocks.EvaluationResult | undefined> {
    let evalResults = undefined;

    try {
        const response = await sendMessageAsync({
            type: "pxteditor",
            action: "runeval",
            validatorPlan: validatorPlan,
            planLib: planLib
        } as pxt.editor.EditorMessageRunEvalRequest);
        const result = response as pxt.editor.EditorMessageResponse;
        validateResponse(result, true); // Throws on failure
        evalResults = result.resp as pxt.blocks.EvaluationResult;
    } catch (e: any) {
        logError(ErrorCode.runEval, e);
    }

    return evalResults;
}
