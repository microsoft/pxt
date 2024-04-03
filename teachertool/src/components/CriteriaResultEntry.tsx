import * as React from "react";
import { useState, useContext, useRef } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { Strings, Ticks } from "../constants";
import { setEvalResultNotes } from "../transforms/setEvalResultNotes";
import { CriteriaEvalResultDropdown } from "./CriteriaEvalResultDropdown";
import { DebouncedTextarea } from "./DebouncedTextarea";
import { getCatalogCriteriaWithId, getCriteriaInstanceWithId } from "../state/helpers";
import { ReadOnlyCriteriaDisplay } from "./ReadonlyCriteriaDisplay";
import { EvaluationStatus } from "../types/criteria";

interface AddNotesButtonProps {
    criteriaId: string;
    setShowInput: (show: boolean) => void;
}

const AddNotesButton: React.FC<AddNotesButtonProps> = ({ criteriaId, setShowInput }) => {
    const onAddNotesClicked = () => {
        pxt.tickEvent(Ticks.AddResultNotes, { criteriaId });
        setShowInput(true);
    };
    return (
        <div className={classList(css["button-container"], css["no-print"])}>
            <Button
                className={classList("inline", "outline-button")}
                label={Strings.AddNotes}
                onClick={onAddNotesClicked}
                title={Strings.AddNotes}
                leftIcon="fas fa-plus-circle"
            />
        </div>
    );
};

interface CriteriaResultNotesProps {
    criteriaId: string;
}

const CriteriaResultNotes: React.FC<CriteriaResultNotesProps> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [value, setValue] = useState(teacherTool.evalResults[criteriaId]?.notes ?? "");

    const onTextChange = (str: string) => {
        setEvalResultNotes(criteriaId, str);
        setValue(str);
    };

    React.useEffect(() => {
        setValue(teacherTool.evalResults[criteriaId]?.notes ?? "");
    }, [teacherTool.evalResults[criteriaId]?.notes]);

    return (
        <div className={css["notes-container"]}>
            <DebouncedTextarea
                placeholder={lf("Write your notes here")}
                ariaLabel={lf("Feedback regarding the criteria result")}
                label={lf("Feedback")}
                title={lf("Write your notes here")}
                initialValue={value}
                autoResize={true}
                onChange={onTextChange}
                autoComplete={false}
                intervalMs={500}
            />
        </div>
    );
};

interface CriteriaResultEntryProps {
    criteriaId: string;
}

export const CriteriaResultEntry: React.FC<CriteriaResultEntryProps> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [showInput, setShowInput] = useState(!!teacherTool.evalResults[criteriaId]?.notes);

    const criteriaInstance = getCriteriaInstanceWithId(teacherTool, criteriaId);
    const catalogCriteria = criteriaInstance ? getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId) : undefined;

    React.useEffect(() => {
        if (!showInput && teacherTool.evalResults[criteriaId]?.notes) {
            setShowInput(true);
        }
    }, [teacherTool.evalResults[criteriaId]?.notes]);

    return (
        <>
            {catalogCriteria && (
                <div className={css["specific-criteria-result"]} key={criteriaId}>
                    <div className={css["result-details"]}>
                        <ReadOnlyCriteriaDisplay
                            catalogCriteria={catalogCriteria}
                            criteriaInstance={criteriaInstance}
                            showDescription={false}
                        />
                        {teacherTool.evalResults[criteriaId].result === EvaluationStatus.InProgress ? (
                            <div className="common-spinner"></div>
                        ) : (
                            <CriteriaEvalResultDropdown
                                result={teacherTool.evalResults[criteriaId].result}
                                criteriaId={criteriaId}
                            />
                        )}
                    </div>
                    <div
                        className={classList(
                            css["result-notes"],
                            teacherTool.evalResults[criteriaId]?.notes ? undefined : css["no-print"]
                        )}
                    >
                        {!showInput && teacherTool.evalResults[criteriaId].result !== EvaluationStatus.InProgress && <AddNotesButton criteriaId={criteriaId} setShowInput={setShowInput} />}
                        {showInput && <CriteriaResultNotes criteriaId={criteriaId} />}
                    </div>
                </div>
            )}
        </>
    );
};
