import * as React from "react";
import * as pkg from "./package";
import * as simulator from "./simulator";
import { Editor } from "./srceditor";
import { getSimxEditorKeyOfMarker } from "./simxEditorHost";

/**
 * Shows the editor tab of a simulator extension: the page its registration
 * names, in a frame that stays loaded, hidden, while another editor is shown,
 * until the project closes.
 */
export class SimxEditor extends Editor {
    // the element the tab frames live in, once rendered
    protected container: HTMLDivElement | undefined;
    // true from when a tab is shown until the editor, displayed, focuses it
    protected focusPending = false;

    getId() {
        return "simxEditor";
    }

    acceptsFile(file: pkg.File) {
        return file.epkg?.getPkgId() === "this"
            && !!getSimxEditorKeyOfMarker(file.name, simulator.getProjectSimxEditorRegistrations());
    }

    setVisible(v: boolean) {
        super.setVisible(v);
        if (!v) {
            this.focusPending = false;
            simulator.simxEditorHost?.hide();
        }
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
            this.focusPending = true;
        });
    }

    // Focuses the shown tab once the render that follows the switch has
    // displayed the editor.
    domUpdate() {
        if (!this.focusPending || !this.isVisible) return;
        this.focusPending = false;
        simulator.simxEditorHost.focus();
    }

    unloadFileAsync(): Promise<void> {
        return Promise.resolve();
    }

    hasEditorToolbarEditingControls() {
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
