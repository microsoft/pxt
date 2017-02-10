namespace pxt.editor {
    export enum EditorAction {
        switchBlocks,
        switchTypeScript,
        startSimulator, // no op if already running
        restartSimulator
    }

    export interface EditorMessageRequest {
        id: string;
        type: "pxteditor",
        action: EditorAction
    }

    export interface EditorMessageResponse {
        type: "pxteditor",
        request: EditorMessageRequest;
        success: boolean;
    }

    export function bindEditorMessages(projectView: IProjectView) {
        if (!window.parent || !pxt.appTarget.appTheme.allowParentController) return;

        window.addEventListener("message", (msg: MessageEvent) => {
            const data = msg.data as EditorMessageRequest;
            if (!data || data.type != "pxteditor") return false;

            let p = Promise.resolve();
            switch (data.action) {
                case EditorAction.switchTypeScript: p = p.then(() => projectView.openJavaScript()); break;
                case EditorAction.switchBlocks: p = p.then(() => projectView.openBlocks()); break;
                case EditorAction.startSimulator: p = p.then(() => projectView.startSimulator()); break;
                case EditorAction.restartSimulator: p = p.then(() => projectView.restartSimulator()); break;
            }
            p.done(() => sendResponse(data, true, undefined),
                (err) => sendResponse(data, false, err))

            return true;
        }, false)
    }

    function sendResponse(request: EditorMessageRequest, success: boolean, error: any) {
        window.parent.postMessage({
            type: "pxteditor",
            request,
            success,
            error
        }, "*");
    }
}