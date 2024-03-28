import { IframeDriver } from "./iframeDriver";

export class AssetEditorDriver extends IframeDriver {
    constructor(frame: HTMLIFrameElement) {
        super(frame);
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
            this.fireEvent((data as pxt.editor.AssetEditorEvent).kind, data);
        }
        else {
            this.resolvePendingMessage(event);
        }
    }
}