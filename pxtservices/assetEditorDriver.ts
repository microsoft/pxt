import { IframeDriver } from "./iframeDriver";

export class AssetEditorDriver extends IframeDriver {
    private backpackSupported: boolean;
    constructor(frame: HTMLIFrameElement) {
        super(frame);
    }

    async openBackpackAsset(code: string, blocksInfo: pxtc.BlocksInfo, gallery: pxt.AssetSnapshot, palette?: string[], name?: string): Promise<void> {
        if (this.backpackSupported === false) throw new Error("backpack_editor_incompatible");
        await this.sendRequest({ type: "open-backpack", code, blocksInfo, gallery, palette, name } as pxt.editor.OpenBackpackAssetEditorRequest);
    }

    async saveBackpackAsset(): Promise<{ code: string; blockText: string; name?: string }> {
        const response = await this.sendRequest({ type: "save-backpack" } as pxt.editor.SaveBackpackAssetEditorRequest) as pxt.editor.SaveBackpackAssetEditorResponse;
        return { code: response.code, blockText: response.blockText, ...(response.name !== undefined ? { name: response.name } : {}) };
    }

    async openAsset(assetId: string, assetType: pxt.AssetType, files: pxt.Map<string>, palette?: string[]) {
        await this.sendRequest(
            {
                type: "open",
                assetId,
                assetType,
                files,
                palette
            } as pxt.editor.OpenAssetEditorRequest
        );
    }

    async createAsset(assetType: pxt.AssetType, files: pxt.Map<string>, displayName?: string, palette?: string[]) {
        await this.sendRequest({
            type: "create",
            assetType,
            files,
            displayName,
            palette
        } as pxt.editor.CreateAssetEditorRequest);
    }

    async saveAsset() {
        const resp = await this.sendRequest({
            type: "save"
        } as pxt.editor.SaveAssetEditorRequest);

        return (resp as pxt.editor.SaveAssetEditorResponse).files;
    }

    async duplicateAsset(assetId: string, assetType: pxt.AssetType, files: pxt.Map<string>, palette?: string[]) {
        await this.sendRequest({
            type: "duplicate",
            assetId,
            assetType,
            files,
            palette
        } as pxt.editor.DuplicateAssetEditorRequest);
    }

    addEventListener(event: "ready", handler: (ev: pxt.editor.AssetEditorReadyEvent) => void): void;
    addEventListener(event: "done-clicked", handler: (ev: pxt.editor.AssetEditorRequestSaveEvent) => void): void;
    addEventListener(event: string, handler: (ev: any) => void): void {
        super.addEventListener(event, handler);
    }

    protected handleMessage(event: MessageEvent<any>): void {
        const data = event.data;
        if (!data) return;

        if (data.type === "event") {
            if (data.kind === "ready") {
                this.backpackSupported = data.backpack === true;
                if (!this.backpackSupported) {
                    // An older deployed iframe silently ignores this new request.
                    for (const id of Object.keys(this.pendingMessages)) {
                        const pending = this.pendingMessages[id];
                        if ((pending.original as unknown as pxt.editor.AssetEditorRequest).type !== "open-backpack") continue;
                        delete this.pendingMessages[id];
                        this.messageQueue = this.messageQueue.filter(message => message !== pending.original);
                        pending.reject(new Error("backpack_editor_incompatible"));
                    }
                }
            }
            this.fireEvent((data as pxt.editor.AssetEditorEvent).kind, data);
        }
        else {
            this.resolvePendingMessage(event);
        }
    }
}