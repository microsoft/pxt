namespace pxt.editor.experiments {
    export interface Experiment {
        id: string; // == field in apptheme also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl: string; // allows user to put feedback
    }

    function key(experiment: Experiment): string {
        return `experiments-${experiment.id}`
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
    }

    export function all(): Experiment[] {
        const ids = pxt.appTarget.appTheme.experiments;
        if (!ids) return [];
        return <Experiment[]>[
            {
                id: "print",
                name: lf("Print Code"),
                description: lf("Print the code from the current project"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4740"
            },
            {
                id: "greenScreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code."),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4738"
            },
            {
                id: "allowPackageExtensions",
                name: lf("Editor Extensions"),
                description: lf("Allow Extensions to add buttons in the editor."),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4741"
            },
            {
                id: "instructions",
                name: lf("Wiring Instructions"),
                description: lf("Generate step-by-step assembly instructions for breadboard wiring."),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4739"
            },
            {
                id: "debugger",
                name: lf("Debugger"),
                description: lf("Step through code and inspect variables in the debugger"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4729"
            },
            {
                id: "bluetoothUartConsole",
                name: "Bluetooth Console",
                description: lf("Receives UART message through Web Bluetooth"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4796"
            },
            {
                id: "bluetoothPartialFlashing",
                name: "Bluetooth Download",
                description: lf("Download code via Web Bluetooth"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/4807"
            },
            {
                id: "simScreenshot",
                name: lf("Simulator Screenshots"),
                description: lf("Download screenshots of the simulator"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/5232"
            },
            {
                id: "python",
                name: lf("Static Python"),
                description: lf("Use Static Python to code your device"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/5390"
            },
            {
                id: "simGif",
                name: lf("Simulator Gifs"),
                description: lf("Download gifs of the simulator"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/5297"
            },
            {
                id: "autoWebUSBDownload",
                name: lf("WebUSB Download"),
                description: lf("Automatically try to download via WebUSB"),
                feedbackUrl: "https://github.com/Microsoft/pxt/issues/5344"
            }
        ].filter(experiment => ids.indexOf(experiment.id) > -1);
    }

    export function clear() {
        all().forEach(experiment => pxt.storage.removeLocal(key(experiment)));
        syncTheme();
    }

    export function someEnabled(): boolean {
        return all().some(experiment => isEnabled(experiment));
    }

    export function isEnabled(experiment: Experiment): boolean {
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