namespace pxt.shell {
    export enum EditorLayoutType {
        IDE,
        Sandbox,
        Widget
    }

    let layoutType: EditorLayoutType;

    function init() {
        if (layoutType !== undefined) return;

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

        pxt.debug(`shell: layout type ${EditorLayoutType[layoutType]}, readonly ${isReadOnly()}`);
    }

    export function layoutTypeClass(): string {
        init();
        return pxt.shell.EditorLayoutType[layoutType].toLowerCase();
    }

    export function isSandboxMode() {
        init();
        return layoutType == EditorLayoutType.Sandbox;
    }

    export function isReadOnly() {
        return isSandboxMode()
            && !/[?&]edit=1/i.test(window.location.href);
    }
}