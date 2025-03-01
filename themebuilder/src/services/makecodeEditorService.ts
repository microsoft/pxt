import { logDebug } from "pxtservices/loggingService";
import { EditorDriver } from "pxtservices/editorDriver";


let driver: EditorDriver | undefined;
let highContrast: boolean = false;

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

        driver.setHighContrast(highContrast);
    }
}

//  an example of events that we want to/can send to the editor
export async function setHighContrastAsync(on: boolean) {
    highContrast = on;

    if (driver) {
        await driver!.setHighContrast(on)
    }
}

export async function sendThemeAsync(theme: pxt.ColorThemeInfo) {
    if (driver) {
        driver.setColorTheme(theme, false);
    }
}
