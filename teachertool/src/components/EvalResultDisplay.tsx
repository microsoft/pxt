import * as React from "react";
import { useContext } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult } from "../types/criteria";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { Strings } from "../constants";


const ResultsHeader: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    // TODO: change the headers to be the correct thing for html (not h3, h4)
    return (
        <div className={css["header"]}>
            <div className={css["rubric-name"]}>
                <h3>{lf("{0}",teacherTool.rubric.name)}</h3>
            </div>
            <div className={css["project-details"]}>
                <h4>{lf("{0}", teacherTool?.projectMetadata?.name)}</h4>
                <p>{teacherTool?.projectMetadata?.id}</p>
            </div>
        </div>
    );
};

interface CriteriaResultProps {
    criteriaId: string;
    result: CriteriaEvaluationResult;
    label: string;
}

const CriteriaResult: React.FC<CriteriaResultProps> = ({ criteriaId, result, label }) => {
    return (
        <div className={css["result-block-id"]} key={criteriaId}>
            <p className={css["block-id-label"]}>
                {label}:
            </p>
            {result === CriteriaEvaluationResult.InProgress && (
                <div className={css["common-spinner"]} />
            )}
            {result === CriteriaEvaluationResult.CompleteWithNoResult && <p>{lf("N/A")}</p>}
            {result === CriteriaEvaluationResult.Fail && (
                <p className={css["negative-text"]}>{lf("Needs Work")}</p>
            )}
            {result === CriteriaEvaluationResult.Pass && (
                <p className={css["positive-text"]}>{lf("Looks Good!")}</p>
            )}
            <Button
                className={classList("inline", "add-button")}
                label={Strings.AddNotes}
                onClick={() => console.log("Add notes getting clicked")}
                title={Strings.AddNotes}
                leftIcon="fas fa-plus-circle"
            />
        </div>
    );
}

export const EvalResultDisplay: React.FC<{}> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function getTemplateStringFromCriteriaInstanceId(instanceId: string): string {
        const catalogCriteriaId = teacherTool.rubric.criteria?.find(
            criteria => criteria.instanceId === instanceId
        )?.catalogCriteriaId;
        if (!catalogCriteriaId) return "";
        return getCatalogCriteriaWithId(catalogCriteriaId)?.template ?? "";
    }

    return (
        <>
            {teacherTool.projectMetadata && (
                <div className={css["eval-results-container"]}>
                    <ResultsHeader />
                    {teacherTool.evalResults.length === 0 && <div className={css["common-spinner"]} />}
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const label = getTemplateStringFromCriteriaInstanceId(criteriaInstanceId);
                        return (
                            label &&
                            <CriteriaResult
                                criteriaId={criteriaInstanceId}
                                result={teacherTool.evalResults[criteriaInstanceId]}
                                label={label}
                            />
                        )
                    })}
                </div>
            )}
        </>
    );
};
