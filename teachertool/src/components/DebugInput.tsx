/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeRubricToFile } from "../services/fileSystemService";
import { AppStateContext } from "../state/appStateContext";
import { showModal } from "../transforms/showModal";

interface IProps {}

export const DebugInput: React.FC<IProps> = ({}) => {
    const {state: teacherTool } = useContext(AppStateContext);

    const evaluate = async () => {
        await runEvaluateAsync();
    };

    const runExport = () => {
        const success = writeRubricToFile(teacherTool.rubric);
    }

    return (
        <div className="debug-container">
            <Button
                id="evaluateSingleProjectButton"
                className="primary"
                onClick={evaluate}
                title={"Evaluate"}
                label={lf("Evaluate")}
            />

            {/* TODO thsparks : move out of debug input */}
            <Button
                id="exportButton"
                className="primary"
                onClick={runExport}
                title={"Export"}
                label={lf("Export")}
            />

            <Button
                id="importButton"
                className="primary"
                onClick={() => showModal("import-rubric")}
                title={"Import"}
                label={lf("Import")}
            />
        </div>
    );
};
