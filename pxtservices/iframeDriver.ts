/// <reference path="../localtypings/pxteditor.d.ts" />

import { IframeClientMessage } from "./iframeEmbeddedClient";

type MessageHandler = (response: any) => void;

const MessageReceivedEvent = "message";
const MessageSentEvent = "sent";

interface PendingMessage {
    original: pxt.editor.EditorMessageRequest;
    resolve: MessageHandler;
    reject: MessageHandler;
}

/**
 * Abstract class for driving communication with an embedded iframe
 */
export abstract class IframeDriver {
    protected readyForMessages = false;
    protected messageQueue: pxt.editor.EditorMessageRequest[] = [];
    protected nextId = 0;
    protected pendingMessages: { [index: string]: PendingMessage } = {};
    protected editorEventListeners: { [index: string]: MessageHandler[] } = {};
    protected port: MessagePort;
    protected portRequestPending: boolean;
    protected frameId: string;

    constructor(public iframe: HTMLIFrameElement) {
        const queryParams = new URLSearchParams(new URL(iframe.src).search);

        if (queryParams.has("frameid")) {
            this.frameId = queryParams.get("frameid")!;
        }

        window.addEventListener("message", this.onMessageReceived);

        // In case this driver was created after the iframe was loaded and we missed
        // the ready event, send a ready request for it to parrot back
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: "iframeclientready"
            } as IframeClientMessage, "*");
        }
    }

    protected abstract handleMessage(message: MessageEvent): void;

    dispose() {
        window.removeEventListener("message", this.onMessageReceived);
        if (this.port) {
            this.port.close();
        }
    }

    addEventListener(event: string, handler: (ev: any) => void): void {
        if (!this.editorEventListeners[event]) this.editorEventListeners[event] = [];
        this.editorEventListeners[event].push(handler);
    }

    removeEventListener(event: string, handler: (ev: any) => void) {
        if (this.editorEventListeners[event]) {
            const filtered = this.editorEventListeners[event].filter(h => h !== handler);

            if (filtered.length === 0) {
                delete this.editorEventListeners[event];
            }
            else {
                this.editorEventListeners[event] = filtered;
            }
        }
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data;

        if (data) {
            if (this.frameId && data.frameId !== this.frameId) {
                return;
            }

            if (data.type === "iframeclientready") {
                if (this.frameId && !this.port) {
                    this.createMessagePort();
                }
                else {
                    this.readyForMessages = true;
                    this.sendMessageCore();
                }
                return;
            }
            else if (data.type === "iframeclientsetmessageport") {
                return;
            }
        }

        this.handleMessage(event);
    }

    protected resolvePendingMessage(event: MessageEvent) {
        const data = event.data as pxt.editor.EditorMessageResponse;
        if (data.id && this.pendingMessages[data.id]) {
            const resp = event.data as pxt.editor.EditorMessageResponse;
            const pending = this.pendingMessages[resp.id!];
            delete this.pendingMessages[resp.id!];

            if (resp.success) {
                pending.resolve(resp);
            }
            else {
                pending.reject(resp.error || new Error("Unknown error: iFrame returned failure"));
            }
        }
    }

    protected fireEvent(event: string, data: any) {
        const listeners = this.editorEventListeners[event];
        if (!listeners) return;

        for (const handler of listeners) {
            try {
                handler(data);
            }
            catch (e) {
                console.error(e);
            }
        }
    }

    protected sendRequest(message: any) {
        return new Promise((resolve, reject) => {
            message.response = true;
            message.id = this.nextId++ + "";
            this.pendingMessages[message.id] = {
                original: message,
                resolve,
                reject
            };
            this.sendMessageCore(message);
        });
    }

    protected sendMessageCore(message?: any) {
        if (message) {
            this.messageQueue.push(message);
        }

        if (this.readyForMessages) {
            while (this.messageQueue.length) {
                const toSend = this.messageQueue.shift();
                if (this.port) {
                    this.port.postMessage(toSend);
                }
                else {
                    this.iframe.contentWindow?.postMessage(toSend, "*");
                }
                this.fireEvent(MessageSentEvent, toSend);
            }
        }
    }

    protected createMessagePort() {
        if (this.port || this.portRequestPending) return;

        this.portRequestPending = true

        const channel = new MessageChannel();

        channel.port1.onmessage = (message: MessageEvent) => {
            if (!this.port) {
                this.port = channel.port1;
                this.frameId = undefined;
                window.removeEventListener("message", this.onMessageReceived);

                this.readyForMessages = true;
                this.sendMessageCore();
            }

            this.onMessageReceived(message);
        };

        this.iframe.contentWindow!.postMessage({
            type: "iframeclientsetmessageport",
        } as IframeClientMessage, "*", [channel.port2]);
    }
}