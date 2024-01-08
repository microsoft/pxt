import { logDebug, logError } from "./loggingService";

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
let iframeLoaded: boolean;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: {[index: string]: PendingMessage} = {};

const onMessageReceived = (event: MessageEvent) => {
    logDebug(`Message received from iframe: ${JSON.stringify(event.data)}`);

    const data = event.data as pxt.editor.EditorMessageRequest;
    if (data.type === "pxteditor") {

        if (data.action === "editorcontentloaded") {
            iframeLoaded = true;
            sendMessageAsync(); // flush message queue.

            getBlocks();
        }

        if (data.id && pendingMessages[data.id]) {
            const pending = pendingMessages[data.id];
            pending.handler(data);
            delete pendingMessages[data.id];
        }
    }
}

const sendMessageAsync = (message?: any) => {
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

        messageQueue.push(message);
        if (makecodeEditorRef) {
            while (messageQueue.length) {
                sendMessageCore(messageQueue.shift());
            }
        }
    });
}

export const setEditorRef = (ref: HTMLIFrameElement | undefined) => {
    iframeLoaded = false;
    if (ref) {
        makecodeEditorRef = ref;
        window.addEventListener("message", onMessageReceived);
    } else {
        makecodeEditorRef = undefined;
        window.removeEventListener("message", onMessageReceived);
    }
}

//  an example of events that we want to/can send to the editor
export const setHighContrastAsync = async (on: boolean) => {
    const result = await sendMessageAsync({
        type: "pxteditor",
        action: "sethighcontrast",
        on: on
    });
    console.log(result);
}

export const getBlocks = async (): Promise<Blockly.Block[]> => { // TODO : create response object with success/fail?
    const request = sendMessageAsync({ type: "pxteditor", action: "getblocks" } as pxt.editor.EditorMessageGetBlocksRequest);

    try {
        const result = await request as pxt.editor.EditorMessageResponse;

        if (result.success) {
            if (result?.resp) {
                const serialzedBlocks = result?.resp?.blocks;
                const workspace = pxt.blocks.loadWorkspaceXml(serialzedBlocks);
                const blocks = workspace.getAllBlocks(false);
                console.log(`DEBUG: BLOCKS ${serialzedBlocks} = ${workspace} = ${blocks} = ${blocks?.length}`);
                return blocks;
            } else {
                throw new Error("Missing response data");
            }
        } else {
            throw new Error("Editor-side failure providing blocks");
        }
    } catch (e: any) {
        logError("get_blocks_error", e);
    }

    return [];
}