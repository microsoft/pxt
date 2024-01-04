interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: {[index: string]: PendingMessage} = {};

const onMessageReceived = (event: MessageEvent) => {
    const data = event.data as pxt.editor.EditorMessageRequest;
    if (data.type === "pxteditor" && data.id && pendingMessages[data.id]) {
        const pending = pendingMessages[data.id];
        pending.handler(data);
        delete pendingMessages[data.id];
        return;
    }
}

export const sendMessageAsync = (message?: any) => {
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

        if (makecodeEditorRef) {
            messageQueue.push(message);
            while (messageQueue.length) {
                sendMessageCore(messageQueue.shift());
            }
            if (message) sendMessageCore(message);
        }
    });
}

export const getIframeRef = (ref: HTMLIFrameElement) => {
    makecodeEditorRef = ref;
    window.addEventListener("message", onMessageReceived);
    makecodeEditorRef.addEventListener("load", () => {console.log("loaded")});
}

export const removeIframeRef = () => {
    makecodeEditorRef = undefined;
    window.removeEventListener("message", onMessageReceived);
}

export const getBlocks = async (): Promise<Blockly.Block[]> => { // TODO : create response object or maybe return EditorMessageGetBlocksResponse?
    const request = sendMessageAsync({
        type: "pxteditor",
        action: "getblocks"
    } as pxt.editor.EditorMessageGetBlocksRequest);
    const result = await request as pxt.editor.EditorMessageGetBlocksResponse;
    return result?.blocks;
}