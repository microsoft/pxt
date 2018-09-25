namespace pxt.editor.experiments {
    export interface Experiment {
        id: string; // == field in apptheme also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl?: string; // allows user to put feedback
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
            pxt.setAppTargetVariant(null);
        }
    }

    export function all(): Experiment[] {
        const ids = pxt.appTarget.appTheme.experiments;
        if (!ids) return [];
        return <Experiment[]>[
            {
                id: "print",
                name: lf("Print Code"),
                description: lf("Print the code from the current project")
            },
            {
                id: "greenScreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code.")
            },
            {
                id: "highContrast",
                name: lf("High Contrast"),
                description: lf("Color theme with higher color contrast.")
            },
            {
                id: "allowPackageExtensions",
                name: lf("Editor Extensions"),
                description: lf("Allow Extensions to add buttons in the editor.")
            },
            {
                id: "instructions",
                name: lf("Wiring Instructions"),
                description: lf("Generate step-by-step assembly instructions for breadboard wiring.")
            },
            {
                id: "enableTrace",
                name: lf("Slow-Mo"),
                description: lf("Step by step automatic execution of the code")
            },
            {
                id: "debugger",
                name: lf("Debugger"),
                description: lf("Step through code and inspect variables in the debugger")
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