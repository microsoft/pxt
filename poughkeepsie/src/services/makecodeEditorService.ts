import { stateAndDispatch } from "../state";
import { emitProjectFiles } from "../utils/emit";
import { logDebug } from "./loggingService";
import { EditorDriver } from "pxtservices/editorDriver";

let driver: EditorDriver | undefined;
let loadedProject = false;

export function setEditorRef(ref: HTMLIFrameElement | undefined) {
    if (driver) {
        if (driver.iframe === ref) return;

        driver.dispose();
        driver = undefined;
    }

    if (ref) {
        driver = new EditorDriver(ref);

        driver.addEventListener("message", ev => {
            logDebug(`Message received from iframe: ${JSON.stringify(ev)}`);
        });
        driver.addEventListener("sent", ev => {
            logDebug(`Sent message to iframe: ${JSON.stringify(ev)}`);
        });
        driver.addEventListener("editorcontentloaded", ev => {
            if (loadedProject) return;
            loadedProject = true;
            loadProject();
        });
    }
}

export async function updateProjectFiles() {
    const { state } = stateAndDispatch();
    const files = emitProjectFiles(state.project) as any;

    delete files["pxt.json"];
    delete files["main.blocks"];
    delete files["main.ts"];

    await driver!.updateProjectFiles(files);
}


function loadProject() {
    const { state } = stateAndDispatch();

    const files = emitProjectFiles(state.project);

    driver!.importProject({
        header: {
            "name": "Untitled",
            "meta": {},
            "editor": "blocksprj",
            "pubId": "",
            "pubCurrent": false,
            "target": "arcade",
            "targetVersion": "1.12.49",
            "id": pxt.Util.guidGen(),
            "recentUse": Date.now(),
            "modificationTime": Date.now(),
            "cloudCurrent": false,
            "saveId": null,
            "_rev": "",
            "githubCurrent": false,
            "cloudVersion": "",
            "cloudLastSyncTime": 1711985603,
            "isDeleted": false
        },
        text: files
    });
}