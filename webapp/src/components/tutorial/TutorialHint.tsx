import * as React from "react";

import { MarkedContent } from "../../marked";
import { TutorialCallout } from "./TutorialCallout";

interface TutorialHintProps {
    parent: pxt.editor.IProjectView;
    markdown: string;

    // Telemetry data
    tutorialId: string;
    currentStep: number;
}

export function TutorialHint(props: TutorialHintProps) {
    const { parent, markdown, tutorialId, currentStep } = props;

    const onHintClick = (visible: boolean) => {
        if (!visible) {
            pxt.tickEvent(`tutorial.showhint`, { tutorial: tutorialId, step: currentStep });
        }
    }

    return <TutorialCallout className="tutorial-hint"
        buttonIcon="key"
        onClick={onHintClick}>
            <div className="hint-title">
                <span>{lf("Answer Key")}</span>
            </div>
            {markdown && <MarkedContent className="hint-content" markdown={markdown} unboxSnippets={true} parent={parent} />}
    </TutorialCallout>
}