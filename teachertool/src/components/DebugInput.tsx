/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { writeRubricToFile } from "../services/fileSystemService";
import { AppStateContext } from "../state/appStateContext";
import { showFilePickerModal } from "../transforms/showFilePickerModal";

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
                onClick={showFilePickerModal}
                title={"Import"}
                label={lf("Import")}
            />
        </div>
    );
};
