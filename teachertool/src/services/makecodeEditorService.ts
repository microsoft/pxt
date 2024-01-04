interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    handler: (response: any) => void;
}

let makecodeEditorRef: HTMLIFrameElement | undefined;
const messageQueue: pxt.editor.EditorMessageRequest[] = [];
let nextId: number = 0;
let pendingMessages: {[index: string]: PendingMessage} = {};


// needs to have reference to the service
const onMessageReceived = (event: MessageEvent) => {
    const data = event.data as pxt.editor.EditorMessageRequest;
    // this logic might have to change for sending messages back
    // need to know what the message from the editor looks like
    if (data.type === "pxteditor" && data.id && pendingMessages[data.id]) {
        const pending = pendingMessages[data.id];
        pending.handler(data);
        delete pendingMessages[data.id];
        return;
    }

    // this switch statement is kinda doing nothing right now.
    // but if you change the "on" property to false, it will turn off high contrast
    // this is just to show that we can send messages to the editor
    // we need the new message from the editor to make sure that it actually works for what we want
    switch (data.action) {
        case "newproject":
            break;
        default:
            sendMessageAsync({
                type: "pxteditor",
                action: "sethighcontrast",
                on: true
            }  as pxt.editor.EditorMessageSetHighContrastRequest);
            console.log(JSON.stringify(data, null, 4));
    }
}

const sendMessageAsync = (message?: any) => {
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
