namespace pxt.editor {
    export interface Experiment {
        id: string; // also assumes image at /static/experiments/ID.png
        name: string;
        description: string;
        feedbackUrl?: string; // allows user to put feedback
        enabled?: boolean;
        apply: (cfg: pxt.AppTarget) => {};
    }

    function experimentKey(experiment: Experiment): string {
        return `experiments-${experiment.id}`
    }

    export function experiments(): Experiment[] {
        return [
            <Experiment>{
                id: "greenscreen",
                name: lf("Green screen"),
                description: lf("Display a webcam video stream or a green background behind the code"),
                apply: cfg => cfg.appTheme.greenScreen = true
            }
        ].map(experiment => {
            experiment.enabled = !!pxt.storage.getLocal(experimentKey(experiment));
            return experiment;
        });
    }

    export function setExperiment(experiment: Experiment, enabled: boolean) {
        experiment.enabled = enabled;
        if (experiment.enabled)
            pxt.storage.setLocal(experimentKey(experiment), "1")
        else
            pxt.storage.removeLocal(experimentKey(experiment));
    }
}