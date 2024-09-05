import * as React from "react";
import { useContext } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { classList } from "react-common/components/util";
import { Strings, Ticks } from "../constants";
import { setEvalResultNotes } from "../transforms/setEvalResultNotes";
import { CriteriaEvalResultDropdown } from "./CriteriaEvalResultDropdown";
import { DebouncedTextarea } from "./DebouncedTextarea";
import { getCatalogCriteriaWithId, getCriteriaInstanceWithId, isProjectLoaded } from "../state/helpers";
import { CriteriaResult, EvaluationStatus } from "../types/criteria";
import { ThreeDotsLoadingDisplay } from "./ThreeDotsLoadingDisplay";
import { CriteriaFeedback } from "./CriteriaFeedback";
import { CriteriaInstanceDisplay } from "./CriteriaInstanceDisplay";
import { runSingleEvaluateAsync } from "../transforms/runSingleEvaluateAsync";
import { removeCriteriaFromChecklist } from "../transforms/removeCriteriaFromChecklist";
import { Button } from "react-common/components/controls/Button";
import { setEvalResult } from "../transforms/setEvalResult";
import { showToast } from "../transforms/showToast";
import { makeToast } from "../utils";
import { readdCriteriaToChecklist } from "../transforms/readdCriteriaToChecklist";

interface CriteriaResultNotesProps {
    criteriaId: string;
}

const CriteriaResultNotes: React.FC<CriteriaResultNotesProps> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const notes = teacherTool.evalResults[criteriaId]?.notes;

    const onTextChange = (str: string) => {
        setEvalResultNotes(criteriaId, str);
    };

    return (
        <>
            <div className={classList(css["notes-container"], "no-print")}>
                <DebouncedTextarea
                    placeholder={lf("Write your notes here")}
                    ariaLabel={lf("Feedback regarding the criteria result")}
                    label={lf("Feedback")}
                    title={lf("Write your notes here")}
                    initialValue={notes}
                    autoResize={true}
                    onChange={onTextChange}
                    autoComplete={false}
                    intervalMs={500}
                />
            </div>
            {notes && <div className={classList(css["notes-container"], css["for-print"], "only-print")}>{notes}</div>}
        </>
    );
};

interface CriteriaResultErrorProps {
    criteriaInstanceId: string;
    error: string;
}

const CriteriaResultError: React.FC<CriteriaResultErrorProps> = ({ criteriaInstanceId, error }) => {
    return (
        <div className={classList(css["result-error"], "no-print")}>
            <i className="fas fa-exclamation-circle"></i>
            <div className={css["error-info-container"]}>
                <span className={css["error-title"]}>{Strings.UnableToEvaluate}</span>
                <span className={css["error-details"]}>{error}</span>
            </div>
            <Button
                className={css["dismiss-button"]}
                leftIcon="fas fa-times-circle"
                title={Strings.Dismiss}
                onClick={() =>
                    setEvalResult(criteriaInstanceId, { result: EvaluationStatus.NotStarted, error: undefined })
                }
            />
        </div>
    );
};

export const UndoDeleteCriteriaButton: React.FC<{ criteriaId: string }> = ({ criteriaId }) => {
    const handleUndoClicked = () => {
        readdCriteriaToChecklist(criteriaId);
    }

    return (
        <Button
            title={Strings.Undo}
            label={Strings.Undo}
            onClick={handleUndoClicked}
        />
    )
}

const CriteriaResultToolbarTray: React.FC<{ criteriaId: string }> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    async function handleEvaluateClickedAsync() {
        pxt.tickEvent(Ticks.Evaluate);
        const success = await runSingleEvaluateAsync(criteriaId, true);

        if (success) {
            showToast(makeToast("success", Strings.EvaluationComplete));
        } else {
            showToast(makeToast("error", Strings.UnableToEvaluate));
        }
    }

    async function handleDeleteClickedAsync() {
        removeCriteriaFromChecklist(criteriaId);
        showToast(makeToast("info", Strings.CriteriaDeleted, 5000, <UndoDeleteCriteriaButton criteriaId={criteriaId} />));
    }

    return (
        <div className={classList(css["result-toolbar-tray"], "no-print")}>
            <Button
                className={classList("secondary", css["control-button"], css["result-toolbar-button"])}
                rightIcon="fas fa-trash"
                title={Strings.Remove}
                onClick={handleDeleteClickedAsync}
            />
            <Button
                className={classList("secondary", css["control-button"], css["result-toolbar-button"])}
                rightIcon="fas fa-play"
                title={Strings.Evaluate}
                onClick={handleEvaluateClickedAsync}
                disabled={!isProjectLoaded(teacherTool)}
            />
        </div>
    );
};

interface CriteriaResultEntryProps {
    criteriaId: string;
}

export const CriteriaResultEntry: React.FC<CriteriaResultEntryProps> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);
    const evalResult: CriteriaResult | undefined = teacherTool.evalResults[criteriaId];
    const evalStatus = evalResult ? evalResult.result : EvaluationStatus.NotStarted;
    const hasFeedback = !!evalResult?.notes;
    const hasError = !!evalResult?.error;

    const criteriaInstance = getCriteriaInstanceWithId(teacherTool, criteriaId);
    const catalogCriteria = criteriaInstance ? getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId) : undefined;

    const isInProgress = evalStatus === EvaluationStatus.InProgress;
    const isNotStarted = evalStatus === EvaluationStatus.NotStarted;

    return (
        <>
            {catalogCriteria && criteriaInstance && (
                <div className={css["specific-criteria-result"]} key={criteriaId} aria-busy={isInProgress}>
                    {/* Criteria Text & Overall Result (Looks Good, Needs Work, Etc...) */}
                    <div className={css["result-details"]}>
                        <CriteriaInstanceDisplay criteriaInstance={criteriaInstance} />
                        {!isInProgress && (
                            <div className={css["result-controls"]}>
                                <CriteriaEvalResultDropdown result={evalStatus} criteriaId={criteriaId} />
                                <CriteriaResultToolbarTray criteriaId={criteriaId} />
                            </div>
                        )}
                    </div>

                    {/* Notes & Errors */}
                    {isInProgress ? (
                        <ThreeDotsLoadingDisplay className={css["loading-display"]} />
                    ) : hasError ? (
                        <CriteriaResultError
                            criteriaInstanceId={criteriaInstance.instanceId}
                            error={evalResult.error!}
                        />
                    ) : (
                        <div className={classList(css["result-notes"], !hasFeedback ? "no-print" : undefined)}>
                            <CriteriaResultNotes criteriaId={criteriaId} />
                        </div>
                    )}

                    {/* Criteria Response Feedback (For us, not student feedback) */}
                    {!isInProgress && !isNotStarted && !hasError && catalogCriteria.requestFeedback && (
                        <CriteriaFeedback
                            criteriaInstanceId={criteriaInstance.instanceId}
                            className={classList("no-print", css["criteria-feedback"])}
                        />
                    )}

                    <div className={css["separator"]}></div>
                </div>
            )}
        </>
    );
};
