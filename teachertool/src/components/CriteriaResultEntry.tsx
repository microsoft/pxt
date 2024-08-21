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

interface CriteriaResultNotesProps {
    criteriaId: string;
}

const CriteriaResultNotes: React.FC<CriteriaResultNotesProps> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const onTextChange = (str: string) => {
        setEvalResultNotes(criteriaId, str);
    };

    return (
        <div className={css["notes-container"]}>
            <DebouncedTextarea
                placeholder={lf("Write your notes here")}
                ariaLabel={lf("Feedback regarding the criteria result")}
                label={lf("Feedback")}
                title={lf("Write your notes here")}
                initialValue={teacherTool.evalResults[criteriaId]?.notes}
                autoResize={true}
                onChange={onTextChange}
                autoComplete={false}
                intervalMs={500}
            />
        </div>
    );
};

interface CriteriaResultErrorProps {
    error: string;
}
const CriteriaResultError: React.FC<CriteriaResultErrorProps> = ({ error }) => {
    return (
        <div className={css["result-error"]}>
            <i className="fas fa-exclamation-circle"></i>
            <div className={css["error-info-container"]}>
                <span className={css["error-title"]}>{Strings.UnableToEvaluate}</span>
                <span className={css["error-details"]}>{error}</span>
            </div>
        </div>
    );
}

const CriteriaResultToolbarTray: React.FC<{ criteriaId: string }> = ({ criteriaId }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    async function handleEvaluateClickedAsync() {
        pxt.tickEvent(Ticks.Evaluate);
        await runSingleEvaluateAsync(criteriaId, true);
    }

    async function handleDeleteClickedAsync() {
        if (confirm(Strings.ConfirmDeleteCriteriaInstance)) {
            removeCriteriaFromChecklist(criteriaId);
        }
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
                        <CriteriaResultError error={evalResult.error!} />
                    ) : (
                        <div className={classList(css["result-notes"], !hasFeedback ? "no-print" : undefined)}>
                            <CriteriaResultNotes criteriaId={criteriaId} />
                        </div>
                    )}

                    {/* Criteria Response Feedback (For us, not student feedback) */}
                    {!isInProgress && !isNotStarted && catalogCriteria.requestFeedback && (
                        <CriteriaFeedback
                            catalogCriteriaId={catalogCriteria.id}
                            className={classList("no-print", css["criteria-feedback"])}
                        />
                    )}

                    <div className={css["separator"]}></div>
                </div>
            )}
        </>
    );
};
