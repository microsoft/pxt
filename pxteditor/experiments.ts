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
        const theme: pxt.Map<boolean> = (pxt.appTarget.appTheme || {}) as any;
        all().forEach(experiment => {
            const enabled = pxt.storage.getLocal(key(experiment));
            theme[experiment.id] = !!enabled;
        })
    }

    export function all(): Experiment[] {
        const ids = pxt.appTarget.appTheme.experiments;
        if (!ids) return [];
        return [
            <Experiment>{
                id: "greenScreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code")
            }
        ].filter(experiment => ids.indexOf(experiment.id) > -1);
    }

    export function isEnabled(experiment: Experiment) {
        const theme: pxt.Map<boolean> = (pxt.appTarget.appTheme || {}) as any;
        return !!theme[experiment.id];
    }

    export function toggle(experiment: Experiment) {
        setState(experiment, !isEnabled(experiment));
    }

    export function state(): string {
        const r: pxt.Map<boolean> = {};
        const state = all().forEach(experiment => r[experiment.id] = isEnabled(experiment));
        return JSON.stringify(state);
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