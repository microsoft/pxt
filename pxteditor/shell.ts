namespace pxt.shell {
    export enum EditorLayoutType {
        IDE,
        Sandbox,
        Widget,
        Controller
    }

    let layoutType: EditorLayoutType;

    function init() {
        if (layoutType !== undefined) return;

        const sandbox = /sandbox=1|#sandbox|#sandboxproject/i.test(window.location.href)
            // in iframe
            || pxt.BrowserUtils.isIFrame();
        const nosandbox = /nosandbox=1/i.test(window.location.href);
        const controller = /controller=1/i.test(window.location.href) && pxt.BrowserUtils.isIFrame();
        const layout = /editorlayout=(widget|sandbox|ide)/i.exec(window.location.href);

        layoutType = EditorLayoutType.IDE;
        if (nosandbox)
            layoutType = EditorLayoutType.Widget;
        else if (controller)
            layoutType = EditorLayoutType.Controller;
        else if (sandbox)
            layoutType = EditorLayoutType.Sandbox;

        if (layout) {
            switch (layout[1].toLowerCase()) {
                case "widget": layoutType = EditorLayoutType.Widget; break;
                case "sandbox": layoutType = EditorLayoutType.Sandbox; break;
                case "ide": layoutType = EditorLayoutType.IDE; break;
            }
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

    export function isControllerMode() {
        init();
        return layoutType == EditorLayoutType.Controller;
    }
}