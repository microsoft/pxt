namespace pxt.shell {
    export enum EditorLayoutType {
        IDE,
        Sandbox,
        Widget,
        Controller
    }

    let layoutType: EditorLayoutType;

    let editorReadonly: boolean = false;
    let noDefaultProject: boolean = false;

    function init() {
        if (layoutType !== undefined) return;
        if (!pxt.BrowserUtils.hasWindow()) {
            layoutType = EditorLayoutType.Sandbox;
        } else {
            const sandbox = /sandbox=1|#sandbox|#sandboxproject/i.test(window.location.href)
                // in iframe
                || pxt.BrowserUtils.isIFrame();
            const nosandbox = /nosandbox=1/i.test(window.location.href);
            const controller = /controller=1/i.test(window.location.href) && pxt.BrowserUtils.isIFrame();
            const readonly = /readonly=1/i.test(window.location.href);
            const layout = /editorlayout=(widget|sandbox|ide)/i.exec(window.location.href);
            const noproject = /noproject=1/i.test(window.location.href);

            layoutType = EditorLayoutType.IDE;
            if (nosandbox)
                layoutType = EditorLayoutType.Widget;
            else if (controller)
                layoutType = EditorLayoutType.Controller;
            else if (sandbox)
                layoutType = EditorLayoutType.Sandbox;

            if (controller && readonly) editorReadonly = true;
            if (controller && noproject) noDefaultProject = true;
            if (layout) {
                switch (layout[1].toLowerCase()) {
                    case "widget": layoutType = EditorLayoutType.Widget; break;
                    case "sandbox": layoutType = EditorLayoutType.Sandbox; break;
                    case "ide": layoutType = EditorLayoutType.IDE; break;
                }
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

    export function isTimeMachineEmbed() {
        return /[?&]timeMachine=1/i.test(window.location.href);
    }

    export function isReadOnly() {
        return (!pxt.BrowserUtils.hasWindow() || isTimeMachineEmbed() || (isSandboxMode()
            && !/[?&]edit=1/i.test(window.location.href)) ||
            (isControllerMode() && editorReadonly));
    }

    export function isNoProject() {
        return noDefaultProject;
    }

    export function isControllerMode() {
        init();
        return layoutType == EditorLayoutType.Controller;
    }

    export function isPyLangPref(): boolean {
        return pxt.storage.getLocal("editorlangpref") == "py";
    }

    export function getEditorLanguagePref(): string {
        return pxt.storage.getLocal("editorlangpref");
    }

    export function setEditorLanguagePref(lang: string): void {
        if (lang.match(/prj$/)) lang = lang.replace(/prj$/, "")
        pxt.storage.setLocal("editorlangpref", lang);
    }

    export function getToolboxAnimation(): string {
        return pxt.storage.getLocal("toolboxanimation");
    }

    export function setToolboxAnimation(): void {
        pxt.storage.setLocal("toolboxanimation", "1");
    }

}