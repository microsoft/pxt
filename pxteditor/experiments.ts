namespace pxt.editor.experiments {
    export interface Experiment {
        id: string; // == field in apptheme also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl?: string; // allows user to put feedback
        enableOnline?: boolean; // requires internet connection, disable in offline app
    }

    function key(experiment: Experiment | string): string {
        const id = (typeof experiment === "object") ? experiment.id : experiment;
        return `experiments-${id}`
    }

    export function syncTheme() {
        const theme: pxt.Map<boolean> = <pxt.Map<boolean>><any>pxt.savedAppTheme();
        const r: pxt.Map<string | number> = {};
        const experiments = all();
        experiments.forEach(experiment => {
            const enabled = isEnabled(experiment);
            theme[experiment.id] = !!enabled;
            if (enabled)
                r[experiment.id] = enabled ? 1 : 0;
        })
        if (experiments.length && Object.keys(r).length) {
            pxt.tickEvent("experiments.loaded", r);
            pxt.reloadAppTargetVariant();
        }
        return pxt.appTarget.appTheme;
    }

    export function all(): Experiment[] {
        const ids = pxt.appTarget.appTheme.experiments;
        if (!ids) return [];
        return [
            {
                id: "print",
                name: lf("Print Code"),
                description: lf("Print the code from the current project"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4740"
            },
            {
                id: "greenScreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code."),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4738"
            },
            {
                id: "allowPackageExtensions",
                name: lf("Editor Extensions"),
                description: lf("Allow Extensions to add buttons in the editor."),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4741"
            },
            {
                id: "instructions",
                name: lf("Wiring Instructions"),
                description: lf("Generate step-by-step assembly instructions for breadboard wiring."),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4739"
            },
            {
                id: "debugger",
                name: lf("Debugger"),
                description: lf("Step through code and inspect variables in the debugger"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4729"
            },
            {
                id: "bluetoothUartConsole",
                name: "Bluetooth Console",
                description: lf("Receives UART message through Web Bluetooth"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4796"
            },
            {
                id: "bluetoothPartialFlashing",
                name: "Bluetooth Download",
                description: lf("Download code via Web Bluetooth"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/4807"
            },
            {
                id: "simScreenshot",
                name: lf("Simulator Screenshots"),
                description: lf("Download screenshots of the simulator"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/5232"
            },
            {
                id: "python",
                name: lf("Static Python"),
                description: lf("Use Static Python to code your device"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/5390"
            },
            {
                id: "simGif",
                name: lf("Simulator Gifs"),
                description: lf("Download gifs of the simulator"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/5297"
            },
            {
                id: "qrCode",
                name: lf("Shared QR Code"),
                description: lf("Generate a QR Code form the shared project url"),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/5456"
            },
            {
                id: "importExtensionFiles",
                name: lf("Import Extension Files"),
                description: lf("Import Extensions from compiled project files")
            },
            {
                id: "debugExtensionCode",
                name: lf("Debug Extension Code"),
                description: lf("Use the JavaScript debugger to debug extension code")
            },
            {
                id: "snippetBuilder",
                name: lf("Snippet Builder"),
                description: lf("Try out the new snippet dialogs.")
            },
            {
                id: "experimentalHw",
                name: lf("Experimental Hardware"),
                description: lf("Enable support for hardware marked 'experimental' in the hardware seletion dialog")
            },
            {
                id: "checkForHwVariantWebUSB",
                name: lf("Detect Hardware with WebUSB"),
                description: lf("When compiling, use WebUSB to detect hardware configuration.")
            },
            {
                id: "githubEditor",
                name: lf("GitHub editor"),
                description: lf("Review, commit and push to GitHub."),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/6419",
                enableOnline: true,
            },
            {
                id: "githubCompiledJs",
                name: lf("GitHub Pages JavaScript"),
                description: lf("Commit compiled javascript when creating a release"),
                enableOnline: true,
            },
            {
                id: "blocksCollapsing",
                name: lf("Collapse blocks"),
                description: lf("Collapse and expand functions or event blocks")
            },
            {
                id: "tutorialBlocksDiff",
                name: lf("Tutorial Block Diffs"),
                description: lf("Automatially render blocks diff in tutorials")
            },
            {
                id: "openProjectNewTab",
                name: lf("Open in New Tab"),
                description: lf("Open an editor in a new tab.")
            },
            {
                id: "openProjectNewDependentTab",
                name: lf("Open in New Connected Tab"),
                description: lf("Open connected editors in different browser tabs.")
            },
            {
                id: "accessibleBlocks",
                name: lf("Accessible Blocks"),
                description: lf("Use the WASD keys to move and modify blocks."),
                feedbackUrl: "https://github.com/microsoft/pxt/issues/6850"
            },
            {
                id: "errorList",
                name: lf("Error List"),
                description: lf("Show an error list panel for JavaScript and Python.")
            },
            {
                id: "blocksErrorList",
                name: lf("Blocks Error List"),
                description: lf("Show an error list panel for Blocks")
            },
            {
                id: "timeMachine",
                name: lf("Time Machine"),
                description: lf("Save and restore past versions of a project")
            },
        ].filter(experiment => ids.indexOf(experiment.id) > -1 && !(pxt.BrowserUtils.isPxtElectron() && experiment.enableOnline));
    }

    export function clear() {
        all().forEach(experiment => pxt.storage.removeLocal(key(experiment)));
        syncTheme();
    }

    export function someEnabled(): boolean {
        return all().some(experiment => isEnabled(experiment));
    }

    export function isEnabled(experiment: Experiment | string): boolean {
        return !!pxt.storage.getLocal(key(experiment));
    }

    export function toggle(experiment: Experiment) {
        setState(experiment, !isEnabled(experiment));
    }

    export function state(): string {
        const r: pxt.Map<boolean> = {};
        all().forEach(experiment => r[experiment.id] = isEnabled(experiment));
        return JSON.stringify(r);
    }

    export function setState(experiment: Experiment, enabled: boolean) {
        if (enabled == isEnabled(experiment)) return; // no changes
        if (enabled)
            pxt.storage.setLocal(key(experiment), "1")
        else
            pxt.storage.removeLocal(key(experiment));
        // sync theme
        syncTheme();
    }
}