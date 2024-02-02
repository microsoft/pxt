/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeRubricToFile } from "../services/fileSystemService";
import { AppStateContext } from "../state/appStateContext";
import { showImportRubricModal } from "../transforms/showImportRubricModal";

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
                className="btn-primary"
                onClick={evaluate}
                title={"Evaluate"}
                label={lf("Evaluate")}
            />

            {/* TODO thsparks : move out of debug input */}
            <Button
                id="exportButton"
                className="btn-primary"
                onClick={runExport}
                title={"Export"}
                label={lf("Export")}
            />

            <Button
                id="importButton"
                className="btn-primary"
                onClick={showImportRubricModal}
                title={"Import"}
                label={lf("Import")}
            />
        </div>
    );
};
