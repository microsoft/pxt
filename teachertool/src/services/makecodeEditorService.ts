import { logDebug, logError } from "./loggingService";

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
let readyForMessages: boolean;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: {[index: string]: PendingMessage} = {};

function onMessageReceived(event: MessageEvent) {
    logDebug(`Message received from iframe: ${JSON.stringify(event.data)}`);

    const data = event.data as pxt.editor.EditorMessageRequest;
    if (data.type === "pxteditor") {
        if (data.action === "editorcontentloaded") {
            readyForMessages = true;
            sendMessageAsync(); // flush message queue.
        }

        if (data.id && pendingMessages[data.id]) {
            const pending = pendingMessages[data.id];
            pending.handler(data);
            delete pendingMessages[data.id];
        }
    }
}

function sendMessageAsync(message?: any) {
    logDebug(`Sending message to iframe: ${JSON.stringify(message)}`);

    return new Promise(resolve => {
        const sendMessageCore = (message: any) => {
            message.response = true;
            message.id = nextId++ + "";
            pendingMessages[message.id] = {
                original: message,
                handler: resolve
            };
            makecodeEditorRef!.contentWindow!.postMessage(message, "*");
        }

        if (message) messageQueue.push(message);
        if (makecodeEditorRef) {
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

export function setEditorRef(ref: HTMLIFrameElement | undefined) {
    readyForMessages = false;
    makecodeEditorRef = ref ?? undefined;
    window.removeEventListener("message", onMessageReceived);
    if (ref) {
        window.addEventListener("message", onMessageReceived);
        sendMessageAsync();
    }
}

//  an example of events that we want to/can send to the editor
export async function setHighContrastAsync(on: boolean) {
    const result = await sendMessageAsync({
        type: "pxteditor",
        action: "sethighcontrast",
        on: on
    });
    console.log(result);
}

export async function runEvalInEditorAsync(serializedRubric: string): Promise<pxt.blocks.EvaluationResult | undefined> {
    const request = sendMessageAsync({ type: "pxteditor", action: "runeval", rubric: serializedRubric } as pxt.editor.EditorMessageRunEvalRequest);

    try {
        const response = await request;

        const result = response as pxt.editor.EditorMessageResponse;

        // Throws on failure
        validateResponse(result, true);

        const evalResults = result.resp.evalResults as pxt.blocks.EvaluationResult;
        return evalResults;
    } catch (e: any) {
        logError("runeval_error", e);
    }

    return undefined;
}