type IframeClientSetMessagePortRequest = {
    type: "iframeclientsetmessageport";
};

type IFrameClientReadyMessage = {
    type: "iframeclientready";
};

export type IframeClientMessage = IframeClientSetMessagePortRequest | IFrameClientReadyMessage;

export class IFrameEmbeddedClient {
    protected frameId: string | undefined;
    protected port: MessagePort;

    constructor(protected messageHandler: (message: MessageEvent) => void) {
        this.frameId = frameId();

        window.addEventListener("message", this.onMessageReceived);
        this.sendReadyMessage();
    }

    dispose() {
        window.removeEventListener("message", this.onMessageReceived);
        if (this.port) {
            this.port.close();
        }
    }

    postMessage(message: any) {
        this.postMessageCore(message);
    }

    protected onMessageReceived = (event: MessageEvent) => {
        const data = event.data;

        if (data) {
            if (data.type === "iframeclientsetmessageport") {
                this.port = event.ports[0];
                this.port.onmessage = this.onMessageReceived;

                this.postMessage({
                    type: "iframeclientsetmessageport"
                } as IframeClientSetMessagePortRequest);
                return;
            }
            else if (data.type === "iframeclientready") {
                this.sendReadyMessage();
                return;
            }
        }

        this.messageHandler(event);
    }

    protected postMessageCore(message: any) {
        if (this.frameId) {
            message.frameId = this.frameId;
        }

        if (this.port) {
            this.port.postMessage(message);
        }
        else if ((window as any).acquireVsCodeApi) {
            (window as any).acquireVsCodeApi().postMessage(message)
        }
        else {
            window.parent.postMessage(message, "*");
        }
    }

    protected sendReadyMessage() {
        this.postMessage({
            type: "iframeclientready"
        });
    }
}

function frameId(): string | undefined {
    const match = /frameid=([a-zA-Z0-9\-]+)/i.exec(window.location.href);

    if (match) {
        return match[1];
    }

    return undefined;
}