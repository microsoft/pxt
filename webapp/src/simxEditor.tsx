import * as React from "react";
import * as pkg from "./package";
import * as simulator from "./simulator";
import { Editor } from "./srceditor";
import { getSimxEditorKeyOfMarker } from "./simxEditorHost";

// PR NOTE [Issue 6] -- lift into the PR description, then remove.
// The editor of simulator extension editor tabs. Like the Assets editor it is
// selected by a marker file: each tab has a virtual file at the project's top
// level, created the first time the tab is opened, and opening that file
// shows the tab. A virtual file does not stop or restart the simulator when
// the editor switches to it, and this editor neither saves nor builds
// anything when it loads or unloads. Its frames live in the simulator
// module's editor-tab host, which keeps them loaded across editor switches.
/**
 * Shows the editor tab of a simulator extension: the page its registration
 * names, in a frame that stays loaded, hidden, while another editor is shown,
 * until the project closes.
 */
export class SimxEditor extends Editor {
    // the element the tab frames live in, once rendered
    protected container: HTMLDivElement | undefined;

    getId() {
        return "simxEditor";
    }

    acceptsFile(file: pkg.File) {
        return file.epkg?.getPkgId() === "this"
            && !!getSimxEditorKeyOfMarker(file.name, simulator.getProjectSimxEditorRegistrations());
    }

    setVisible(v: boolean) {
        super.setVisible(v);
        if (!v) simulator.simxEditorHost?.hide();
    }

    loadFileAsync(file: pkg.File, hc?: boolean): Promise<void> {
        return super.loadFileAsync(file, hc).then(() => {
            const registrations = simulator.getProjectSimxEditorRegistrations();
            const key = getSimxEditorKeyOfMarker(file.name, registrations);
            const registration = registrations.find(r => r.key === key);
            if (!registration || !this.container) return;
            simulator.simxEditorHost.show(registration, this.container, {
                parentOrigin: window.location.origin,
                target: pxt.appTarget.id,
                project: pkg.mainEditorPkg().header?.id,
                language: pxt.Util.userLanguage(),
            });
        });
    }

    unloadFileAsync(): Promise<void> {
        return Promise.resolve();
    }

    hasEditorToolbar() {
        return false;
    }

    hasHistory() {
        return false;
    }

    hasUndo() {
        return false;
    }

    hasRedo() {
        return false;
    }

    protected handleContainerRef = (el: HTMLDivElement) => {
        if (el) this.container = el;
    }

    display(): JSX.Element {
        return <div className="simx-editor" ref={this.handleContainerRef} />;
    }
}
