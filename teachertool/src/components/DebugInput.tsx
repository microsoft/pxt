/// <reference path="../../../built/pxtblocks.d.ts"/>

import { Button } from "react-common/components/controls/Button";
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
