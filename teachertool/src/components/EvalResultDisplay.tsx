import * as React from "react";
import { useContext, useState } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { CriteriaResultEntry } from "./CriteriaResultEntry";
import { QRCodeSVG } from "qrcode.react";
import { getProjectLink } from "../utils";
import { classList } from "react-common/components/util";
import { AddCriteriaButton } from "./AddCriteriaButton";
import { DebouncedInput } from "./DebouncedInput";
import { setChecklistName } from "../transforms/setChecklistName";
import { Strings } from "../constants";
import { Button } from "react-common/components/controls/Button";

const ResultsHeader: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const { checklist, projectMetadata } = teacherTool;
    let { name: checklistName } = checklist;
    const [checklistNameInputRef, setChecklistNameInputRef] = useState<HTMLInputElement | null>(null);

    return (
        <>
            <div className={css["header"]}>
                <div className={css["checklist-name-input"]}>
                    <div className={classList(css["checklist-name"], "only-print")}>
                        <h2>{checklistName}</h2>
                    </div>
                    <DebouncedInput
                        className="no-print"
                        ariaLabel={Strings.Name}
                        onChange={setChecklistName}
                        placeholder={Strings.ChecklistName}
                        initialValue={checklistName}
                        preserveValueOnBlur={true}
                        handleInputRef={setChecklistNameInputRef}
                    />
                    <Button
                        className={classList(css["edit-checklist-name-button"], "no-print")}
                        onClick={() => checklistNameInputRef?.focus()}
                        title={Strings.AddCriteria}
                        leftIcon="fas fa-pencil-alt"
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
                <ResultsHeader />
                <CriteriaWithResultsTable />
                <ResultsFooterControls />
            </div>
        </>
    );
};
