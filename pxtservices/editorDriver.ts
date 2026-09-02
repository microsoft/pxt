/// <reference path="../localtypings/pxteditor.d.ts" />

import { IframeDriver } from "./iframeDriver";

const MessageReceivedEvent = "message";
const MessageSentEvent = "sent";

export interface IframeWorkspaceStatus {
    projects: pxt.workspace.Project[];
    editor?: pxt.editor.EditorSyncState;
    controllerId?: string;
}

export interface IFrameWorkspaceHost {
    saveProject(project: pxt.workspace.Project): Promise<void>;
    getWorkspaceProjects(): Promise<IframeWorkspaceStatus>;
    resetWorkspace(): Promise<void>;
    onWorkspaceLoaded?(): Promise<void>;
}

/**
 * Manages communication with the editor iframe.
 */
export class EditorDriver extends IframeDriver {
    constructor(public iframe: HTMLIFrameElement, public host?: IFrameWorkspaceHost) {
        super(iframe);
    }

    async switchEditorLanguage(lang: "typescript" | "blocks" | "python") {
        let action;
        switch (lang) {
            case "blocks":
                action = "switchblocks";
                break;
            case "typescript":
                action = "switchjavascript";
                break;
            case "python":
                action = "switchpython";
                break;
        }

        await this.sendRequest(
            {
                type: "pxteditor",
                action
            } as pxt.editor.EditorMessageRequest
        );
    }

    async setLanguageRestriction(restriction: pxt.editor.LanguageRestriction) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "setlanguagerestriction",
                restriction
            } as pxt.editor.EditorSetLanguageRestriction
        );
    }

    async startSimulator() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "startsimulator"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async stopSimulator(unload = false) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "stopsimulator",
                unload
            } as pxt.editor.EditorMessageStopRequest
        );
    }

    async restartSimulator() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "restartsimulator"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async hideSimulator() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "hidesimulator"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async showSimulator() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "showsimulator"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async setSimulatorFullscreen(on: boolean) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "setsimulatorfullscreen",
                enabled: on
            } as pxt.editor.EditorMessageSetSimulatorFullScreenRequest
        );
    }

    async closeFlyout() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "closeflyout"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async unloadProject() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "unloadproject"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async saveProject() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "saveproject"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async compile() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "compile"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async undo() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "undo"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async redo() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "redo"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async setHighContrast(on: boolean) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "sethighcontrast",
                on
            } as pxt.editor.EditorMessageSetHighContrastRequest
        );
    }

    async showThemePicker() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "showthemepicker"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async toggleHighContrast() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "togglehighcontrast"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async toggleGreenScreen() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "togglegreenscreen"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async toggleAccessibleBlocks() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "togglekeyboardcontrols"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async toggleSloMo(intervalSpeed?: number) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "toggletrace",
                intervalSpeed
            } as pxt.editor.EditorMessageToggleTraceRequest
        );
    }

    async setSloMoEnabled(enabled: boolean, intervalSpeed?: number) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "settracestate",
                enabled,
                intervalSpeed
            } as pxt.editor.EditorMessageSetTraceStateRequest
        );
    }

    async printProject() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "print"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async getInfo(): Promise<pxt.editor.InfoMessage> {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "info"
            } as pxt.editor.EditorMessageRequest
        ) as pxt.editor.EditorMessageResponse;

        return (resp.resp as pxt.editor.InfoMessage);
    }

    async newProject(options: pxt.editor.ProjectCreationOptions) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "newproject",
                options
            } as pxt.editor.EditorMessageNewProjectRequest
        );
    }

    async importProject(project: pxt.workspace.Project, filters?: pxt.editor.ProjectFilters, searchBar?: boolean) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "importproject",
                project,
                filters,
                searchBar
            } as pxt.editor.EditorMessageImportProjectRequest
        );
    }

    async importExternalProject(project: pxt.workspace.Project) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "importexternalproject",
                project,
            } as pxt.editor.EditorMessageImportExternalProjectRequest
        ) as pxt.editor.EditorMessageImportExternalProjectResponse;

        return resp.resp.importUrl;
    }

    async openHeader(headerId: string) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "openheader",
                headerId
            } as pxt.editor.EditorMessageOpenHeaderRequest
        );
    }

    async shareHeader(headerId: string, projectName: string) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "shareproject",
                headerId,
                projectName
            } as pxt.editor.EditorShareRequest
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp as pxt.editor.ShareData;
    }

    async startActivity(activityType: "tutorial" | "example" | "recipe", path: string, title?: string, previousProjectHeaderId?: string, carryoverPreviousCode?: boolean) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "startactivity",
                activityType,
                path,
                title,
                previousProjectHeaderId,
                carryoverPreviousCode
            } as pxt.editor.EditorMessageStartActivity
        );
    }

    async importTutorial(markdown: string) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "importtutorial",
                markdown
            } as pxt.editor.EditorMessageImportTutorialRequest
        );
    }

    async pair() {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "pair"
            } as pxt.editor.EditorMessageRequest
        );
    }

    async decompileToBlocks(ts: string, snippetMode?: boolean, layout?: pxt.editor.BlockLayout) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "renderblocks",
                ts,
                snippetMode,
                layout
            } as pxt.editor.EditorMessageRenderBlocksRequest
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp as pxt.editor.EditorMessageRenderBlocksResponse;
    }

    async decompileToPython(ts: string) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "renderpython",
                ts
            } as pxt.editor.EditorMessageRenderPythonRequest
        ) as pxt.editor.EditorMessageResponse;

        return (resp.resp as pxt.editor.EditorMessageRenderPythonResponse).python;
    }

    async renderXml(xml: string) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "renderxml",
                xml
            } as pxt.editor.EditorMessageRenderXmlRequest
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp;
    }

    async renderByBlockId(blockId: string) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "renderbyblockid",
                blockId: blockId
            } as pxt.editor.EditorMessageRenderByBlockIdRequest
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp;
    }

    async getToolboxCategories(advanced?: boolean): Promise<pxt.editor.ToolboxCategoryDefinition[]> {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "gettoolboxcategories",
                advanced
            } as pxt.editor.EditorMessageGetToolboxCategoriesRequest
        ) as pxt.editor.EditorMessageResponse;

        return (resp.resp as pxt.editor.EditorMessageGetToolboxCategoriesResponse).categories;
    }

    async getBlockAsText(blockId: string): Promise<pxt.editor.BlockAsText | undefined> {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "getblockastext",
                blockId
            } as pxt.editor.EditorMessageGetBlockAsTextRequest
        ) as pxt.editor.EditorMessageResponse;

        return (resp.resp as pxt.editor.EditorMessageGetBlockAsTextResponse)?.blockAsText;
    }

    async runValidatorPlan(validatorPlan: pxt.blocks.ValidatorPlan, planLib: pxt.blocks.ValidatorPlan[]) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "runeval",
                validatorPlan,
                planLib,
            } as pxt.editor.EditorMessageRunEvalRequest
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp as pxt.blocks.EvaluationResult;
    }

    async saveLocalProjectsToCloud(headerIds: string[]) {
        const resp = await this.sendRequest(
            {
                type: "pxteditor",
                action: "savelocalprojectstocloud",
                headerIds
            } as pxt.editor.EditorMessageSaveLocalProjectsToCloud
        ) as pxt.editor.EditorMessageResponse;

        return resp.resp as pxt.editor.EditorMessageSaveLocalProjectsToCloudResponse;
    }

    async convertCloudProjectsToLocal(userId: string) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "convertcloudprojectstolocal",
                userId
            } as pxt.editor.EditorMessageConvertCloudProjectsToLocal
        );
    }

    async requestProjectCloudStatus(headerIds: string[]) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "requestprojectcloudstatus",
                headerIds
            } as pxt.editor.EditorMessageRequestProjectCloudStatus
        );
    }

    async precacheTutorial(data: pxt.github.GHTutorialResponse) {
        await this.sendRequest(
            {
                type: "pxteditor",
                action: "precachetutorial",
                data
            } as pxt.editor.PrecacheTutorialRequest
        );
    }

    async setColorTheme(colorThemeId: string, savePreference: boolean) {
        await this.sendRequest (
            {
                type: "pxteditor",
                action: "setcolorthemebyid",
                colorThemeId,
                savePreference
            } as pxt.editor.EditorMessageSetColorThemeRequest
        );
    }

    addEventListener(event: typeof MessageSentEvent, handler: (ev: pxt.editor.EditorMessage) => void): void;
    addEventListener(event: typeof MessageReceivedEvent, handler: (ev: pxt.editor.EditorMessage) => void): void;
    addEventListener(event: "event", handler: (ev: pxt.editor.EditorMessageEventRequest) => void): void;
    addEventListener(event: "simevent", handler: (ev: pxt.editor.EditorSimulatorEvent) => void): void;
    addEventListener(event: "tutorialevent", handler: (ev: pxt.editor.EditorMessageTutorialEventRequest) => void): void;
    addEventListener(event: "workspacesave", handler: (ev: pxt.editor.EditorWorkspaceSaveRequest) => void): void;
    addEventListener(event: "workspaceevent", handler: (ev: pxt.editor.EditorWorkspaceEvent) => void): void;
    addEventListener(event: "workspacereset", handler: (ev: pxt.editor.EditorWorkspaceSyncRequest) => void): void;
    addEventListener(event: "workspacesync", handler: (ev: pxt.editor.EditorWorkspaceSyncRequest) => void): void;
    addEventListener(event: "workspaceloaded", handler: (ev: pxt.editor.EditorWorkspaceSyncRequest) => void): void;
    addEventListener(event: "workspacediagnostics", handler: (ev: pxt.editor.EditorWorkspaceDiagnostics) => void): void;
    addEventListener(event: "editorcontentloaded", handler: (ev: pxt.editor.EditorContentLoadedRequest) => void): void;
    addEventListener(event: "projectcloudstatus", handler: (ev: pxt.editor.EditorMessageProjectCloudStatus) => void): void;
    addEventListener(event: "serviceworkerregistered", handler: (ev: pxt.editor.EditorMessageServiceWorkerRegisteredRequest) => void): void;
    addEventListener(event: string, handler: (ev: any) => void): void {
        super.addEventListener(event, handler);
    }

    sendMessage(message: pxt.editor.EditorMessageRequest): Promise<pxt.editor.EditorMessageResponse> {
        return this.sendRequest(message) as Promise<pxt.editor.EditorMessageResponse>;
    }

    protected handleMessage(event: MessageEvent) {
        const data = event.data as pxt.editor.EditorMessageRequest;
        if (!data || !/^pxt(host|editor|pkgext|sim)$/.test(data.type)) return;

        if (data.type === "pxteditor") {
            this.resolvePendingMessage(event);
        }
        else if (data.type === "pxthost") {
            if (data.action === "editorcontentloaded") {
                this.readyForMessages = true;
                this.sendMessageCore(); // flush message queue.
            }
            else if (data.action === "workspacesync" || data.action === "workspacesave" || data.action === "workspacereset" || data.action === "workspaceloaded") {
                this.handleWorkspaceSync(data as pxt.editor.EditorWorkspaceSyncRequest);
            }

            this.fireEvent(data.action, data);
        }

        this.fireEvent(MessageReceivedEvent, data);
    }

    protected async handleWorkspaceSync(event: pxt.editor.EditorWorkspaceSyncRequest | pxt.editor.EditorWorkspaceSaveRequest) {
        if (!this.host) return;

        let error: any = undefined;
        try {
            if (event.action === "workspacesync") {
                const status = await this.host.getWorkspaceProjects();
                this.sendMessageCore({
                    type: "pxthost",
                    id: event.id,
                    success: !!status,
                    projects: status?.projects,
                    editor: status?.editor,
                    controllerId: status?.controllerId
                } as pxt.editor.EditorWorkspaceSyncResponse);
            }
            else if (event.action === "workspacereset") {
                await this.host.resetWorkspace();
            }
            else if (event.action === "workspacesave") {
                await this.host.saveProject(event.project);
            }
            else if (event.action === "workspaceloaded") {
                if (this.host.onWorkspaceLoaded) {
                    await this.host.onWorkspaceLoaded();
                }
            }
        }
        catch (e) {
            error = e;
            pxt.error(e);
        }
        finally {
            if (event.response) {
                this.sendMessageCore({
                    type: "pxthost",
                    id: event.id,
                    success: !error,
                    error
                } as pxt.editor.EditorMessageResponse);
            }
        }
    }
}
