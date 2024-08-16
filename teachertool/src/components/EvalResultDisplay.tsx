import * as React from "react";
import { useContext, useState } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { useReactToPrint } from "react-to-print";
import { AppStateContext } from "../state/appStateContext";
import { CriteriaResultEntry } from "./CriteriaResultEntry";
import { QRCodeSVG } from "qrcode.react";
import { getProjectLink } from "../utils";
import { classList } from "react-common/components/util";
import { AddCriteriaButton } from "./AddCriteriaButton";
import { DebouncedInput } from "./DebouncedInput";
import { setChecklistName } from "../transforms/setChecklistName";
import { Strings, Ticks } from "../constants";
import { Button } from "react-common/components/controls/Button";
import { Toolbar } from "./Toolbar";
import { setAutorun } from "../transforms/setAutorun";
import { runEvaluateAsync } from "../transforms/runEvaluateAsync";
import { isProjectLoaded } from "../state/helpers";
import { showToast } from "../state/actions";
import { makeToast } from "../utils";
import { getSafeChecklistName } from "../state/helpers";
import { writeChecklistToFile } from "../services/fileSystemService";

interface ResultsHeaderProps {
    printRef: React.RefObject<HTMLDivElement>;
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({ printRef }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { checklist, projectMetadata, autorun } = teacherTool;
    let { name: checklistName } = checklist;
    const [checklistNameInputRef, setChecklistNameInputRef] = useState<HTMLInputElement | null>(null);

    const handleRenameClicked = () => {
        checklistNameInputRef?.focus();
        checklistNameInputRef?.setSelectionRange(0, checklistNameInputRef.value.length);
    };

    const onAutorunToggled = (checked: boolean) => {
        pxt.tickEvent(Ticks.Autorun, { checked: checked ? "true" : "false" });
        setAutorun(checked);
    };

    const handleEvaluateClickedAsync = async () => {
        pxt.tickEvent(Ticks.Evaluate);
        await runEvaluateAsync(true);
    }

    const printFn = useReactToPrint({
        content: () => printRef.current,
        onPrintError: () => showToast(makeToast("error", lf("Unable to print evaluation results"), 2000)),
        documentTitle: `${pxt.Util.sanitizeFileName(getSafeChecklistName(teacherTool)!)} - ${pxt.Util.sanitizeFileName(
            teacherTool.projectMetadata?.name || Strings.UntitledProject
        )}`,
    });

    const handlePrintClicked = () => {
        pxt.tickEvent(Ticks.Print);
        printFn();
    }

    const handleExportChecklistClicked = () => {
        pxt.tickEvent(Ticks.ExportChecklist);
        writeChecklistToFile(checklist);
    }

    return (
        <>
            <div className={css["header"]}>
                <div className={classList(css["checklist-control-tray"], "no-print")}>
                    <Button className={classList("secondary", css["control-button"])} label={Strings.Rename} title={Strings.RenameChecklist} rightIcon="fas fa-pencil-alt" onClick={handleRenameClicked} />
                    <Button className={classList("secondary", css["control-button"])} label={Strings.Print} title={Strings.PrintChecklist} rightIcon="fas fa-print" onClick={handlePrintClicked} />
                    <Button className={classList("secondary", css["control-button"])} label={Strings.Evaluate} title={Strings.EvaluateChecklist} rightIcon="fas fa-play" onClick={handleEvaluateClickedAsync} disabled={!isProjectLoaded(teacherTool)} />
                    <Toolbar.Toggle
                        className={classList("secondary", css["control-button"])}
                        label={Strings.AutoRun}
                        title={Strings.AutoRunDescription}
                        isChecked={autorun}
                        onToggle={onAutorunToggled}
                    />
                    <Button className={classList("secondary", css["control-button"])} label={Strings.Export} title={Strings.ExportChecklist} rightIcon="fas fa-download" onClick={handleExportChecklistClicked} disabled={!isProjectLoaded(teacherTool)} />

                </div>
                <div className={css["checklist-name"]}>
                    <div className={css["checklist-name-input"]}>
                        <div className={classList(css["checklist-name"], "only-print")}>
                            <h2>{checklistName}</h2>
                        </div>
                        <DebouncedInput
                            className="no-print"
                            ariaLabel={Strings.Name}
                            onChange={setChecklistName}
                            placeholder={Strings.ChecklistNamePlaceholder}
                            initialValue={checklistName}
                            preserveValueOnBlur={true}
                            handleInputRef={setChecklistNameInputRef}
                        />
                    </div>
                    {projectMetadata && (
                        <div className={classList(css["project-details"], "only-print")}>
                            <div className={css["project-text"]}>
                                <h3>{teacherTool?.projectMetadata?.name}</h3>
                                <p>{getProjectLink(teacherTool.projectMetadata?.inputText!)}</p>
                            </div>
                            <div className={css["project-qrcode"]}>
                                <QRCodeSVG size={60} value={getProjectLink(teacherTool.projectMetadata?.inputText!)} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className={css["separator"]}></div>
        </>
    );
};

const CriteriaWithResultsTable: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { checklist } = teacherTool;
    const { criteria } = checklist;

    return (
        <div className={css["results-list"]}>
            {Object.values(criteria).map(criteriaInstance => {
                return (
                    <CriteriaResultEntry criteriaId={criteriaInstance.instanceId} key={criteriaInstance.instanceId} />
                );
            })}
        </div>
    );
};

const ResultsFooterControls: React.FC = () => {
    return (
        <div className={classList(css["footer"], "no-print")}>
            <AddCriteriaButton />
        </div>
    );
};

interface EvalResultDisplayProps {
    resultsRef: React.RefObject<HTMLDivElement>;
}

export const EvalResultDisplay: React.FC<EvalResultDisplayProps> = ({ resultsRef }) => {
    return (
        <>
            <div className={css["eval-results-container"]} ref={resultsRef}>
                <ResultsHeader printRef={resultsRef} />
                <CriteriaWithResultsTable />
                <ResultsFooterControls />
            </div>
        </>
    );
};
