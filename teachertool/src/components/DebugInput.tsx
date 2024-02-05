import { useState } from "react";
import { Button } from "react-common/components/controls/Button";
import { Input } from "react-common/components/controls/Input";
import { Textarea } from "react-common/components/controls/Textarea";
import { loadProjectMetadataAsync } from "../transforms/loadProjectMetadataAsync";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";

interface IProps {}

export const DebugInput: React.FC<IProps> = ({}) => {
    const evaluate = async () => {
        await runEvaluateAsync();
    };

    return (
        <div className="debug-container">
            <Button
                id="evaluateSingleProjectButton"
                className="primary"
                onClick={evaluate}
                title={"Evaluate"}
                label={lf("Evaluate")}
            />
        </div>
    );
};
