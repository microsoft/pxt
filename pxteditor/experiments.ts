namespace pxt.editor {
    export interface Experiment {
        id: string; // == field in apptheme also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl?: string; // allows user to put feedback
    }

    function experimentKey(experiment: Experiment): string {
        return `experiments-${experiment.id}`
    }

    export function syncTheme() {
        const theme: pxt.Map<boolean> = (pxt.appTarget.appTheme || {}) as any;
        experiments().forEach(experiment => {
            const enabled = pxt.storage.getLocal(experimentKey(experiment));
            theme[experiment.id] = !!enabled;
        })
    }

    export function experiments(): Experiment[] {
        return [
            <Experiment>{
                id: "greenScreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code")
            }
        ];
    }

    export function isEnabled(experiment: Experiment) {
        const theme: pxt.Map<boolean> = (pxt.appTarget.appTheme || {}) as any;
        return !!theme[experiment.id];
    }

    export function setExperiment(experiment: Experiment, enabled: boolean) {
        if (enabled)
            pxt.storage.setLocal(experimentKey(experiment), "1")
        else
            pxt.storage.removeLocal(experimentKey(experiment));
        // sync theme
        syncTheme();
    }
}