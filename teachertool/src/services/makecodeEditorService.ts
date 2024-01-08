interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: {[index: string]: PendingMessage} = {};

function onMessageReceived(event: MessageEvent) {
    const data = event.data as pxt.editor.EditorMessageRequest;
    if (data.type === "pxteditor" && data.id && pendingMessages[data.id]) {
        const pending = pendingMessages[data.id];
        pending.handler(data);
        delete pendingMessages[data.id];
        return;
    }

    console.log("Received message from iframe:", data);
}

function sendMessageAsync(message?: any) {
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

export function setEditorRef(ref: HTMLIFrameElement | undefined) {
    if (ref) {
        makecodeEditorRef = ref;
        window.addEventListener("message", onMessageReceived);
    } else {
        makecodeEditorRef = undefined;
        window.removeEventListener("message", onMessageReceived);
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
