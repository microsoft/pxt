namespace pxt.shell {
    export enum EditorLayoutType {
        IDE,
        Sandbox,
        Widget
    }

    export var layoutType: EditorLayoutType;

    export function init() {
        const sandbox = /sandbox=1|#sandbox|#sandboxproject/i.test(window.location.href)
            // in iframe
            || pxt.BrowserUtils.isIFrame();

        const nosandbox = /nosandbox=1/i.test(window.location.href);
        if (nosandbox) {
            layoutType = EditorLayoutType.Widget;
        } else if (sandbox) {
            layoutType = EditorLayoutType.Sandbox;
        } else {
            layoutType = EditorLayoutType.IDE;
        }
    }

    export function isSandboxMode() {
        return layoutType == EditorLayoutType.Sandbox;
    }

    export function isReadOnly() {
        return isSandboxMode()
            && !/[?&]edit=1/i.test(window.location.href);
    }
}