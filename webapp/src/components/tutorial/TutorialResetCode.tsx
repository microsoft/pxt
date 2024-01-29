import * as React from "react";

import { TutorialCallout } from "./TutorialCallout";
import { Button } from "../../../../react-common/components/controls/Button";

interface TutorialResetCodeProps {
    resetTemplateCode: (keepAssets: boolean) => Promise<void>;

    // Telemetry data
    tutorialId: string;
    currentStep: number;
}

export function TutorialResetCode(props: TutorialResetCodeProps) {
    const { resetTemplateCode, tutorialId, currentStep } = props;
    const [ reloading, setReloading ] = React.useState(false);

    const onResetClick = async () => {
        pxt.tickEvent(`tutorial.resetcode`, { tutorial: tutorialId, step: currentStep });
        setReloading(true);
        try {
            await resetTemplateCode(true);
        } finally {
            document.dispatchEvent(new Event("click"));
            setReloading(false);
        }
    }

    return <TutorialCallout buttonLabel={lf("Replace my code")} className="tutorial-replace-code">
        <p>{lf("Did the code you're working with get off track? It happens.")}</p>
        <p>{lf("Click below to replace your code with updated blocks.")}</p>
        <p>{lf("This will delete all your current code blocks. Any custom images and tiles can still be found in the gallery under \"My Assets\".")}</p>
        <div className="tutorial-replace-code-actions">
            <Button
                className="primary"
                label={lf("Replace my code")}
                disabled={reloading}
                onClick={onResetClick}
            />
        </div>
    </TutorialCallout>
}