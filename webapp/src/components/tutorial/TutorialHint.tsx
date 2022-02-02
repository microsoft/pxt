import * as React from "react";

import { MarkedContent } from "../../marked";
import { TutorialCallout } from "./TutorialCallout";

interface TutorialHintProps {
    parent: pxt.editor.IProjectView;
    markdown: string;
    showLabel?: boolean;

    // Telemetry data
    tutorialId: string;
    currentStep: number;
}

export function TutorialHint(props: TutorialHintProps) {
    const { parent, markdown, showLabel, tutorialId, currentStep } = props;

    const onHintClick = (visible: boolean) => {
        if (!visible) {
            pxt.tickEvent(`tutorial.showhint`, { tutorial: tutorialId, step: currentStep });
        }
    }

    return <TutorialCallout className="tutorial-hint"
            buttonLabel={showLabel ? lf("Hint") : undefined}
            buttonIcon="lightbulb"
            onClick={onHintClick}>
                {markdown && <MarkedContent markdown={markdown} unboxSnippets={true} parent={parent} />}
        </TutorialCallout>
}