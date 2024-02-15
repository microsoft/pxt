/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult } from "../types/criteria";

interface IProps {}

export const EvalResultDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function getCriteriaInstanceDisplayString(instanceId: string): string {
        const criteriaInstance = teacherTool.rubric.criteria?.find(
            criteria => criteria.instanceId === instanceId
        );
        if (!criteriaInstance) return "";

        const catalogCriteriaId = criteriaInstance.catalogCriteriaId;
        if (!catalogCriteriaId) return "";

        const templateString = getCatalogCriteriaWithId(catalogCriteriaId)?.template;
        if (!templateString) return "";

        let displayString = templateString;
        for (const param of criteriaInstance.params ?? []) {
            displayString = displayString.replace(`\${${param.name}}`, param.value);
        }

        return displayString;
    }

    return (
        <>
            {teacherTool.projectMetadata && (
                <div className="eval-results-container">
                    <h3>{lf("Project: {0}", teacherTool.projectMetadata.name)}</h3>

                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const result = teacherTool.evalResults[criteriaInstanceId];
                        const label = getCriteriaInstanceDisplayString(criteriaInstanceId);
                        return (
                            label && (
                                <div key={criteriaInstanceId}>
                                <div className="result-block-id">
                                    <p className="block-id-label">
                                        {label}:
                                    </p>
                                    {result.result === CriteriaEvaluationResult.InProgress && (
                                        <div className="common-spinner" />
                                    )}
                                    {result.result === CriteriaEvaluationResult.CompleteWithNoResult && <p>{lf("N/A")}</p>}
                                    {result.result === CriteriaEvaluationResult.Fail && (
                                        <p className="negative-text">{lf("Needs Work")}</p>
                                    )}
                                    {result.result === CriteriaEvaluationResult.Pass && (
                                        <p className="positive-text">{lf("Looks Good!")}</p>
                                    )}
                                </div>
                                {result.notes && <p className="notes">{result.notes}</p>}
                                </div>
                            )
                        );
                    })}
                </div>
            )}
        </>
    );
};
