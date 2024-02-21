import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult } from "../types/criteria";

interface IProps {}

export const EvalResultDisplay: React.FC<IProps> = ({}) => {
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
                <div className="eval-results-container">
                    <h3>{lf("Project: {0}", teacherTool.projectMetadata.name)}</h3>

                    {teacherTool.evalResults.length === 0 && <div className="common-spinner" />}
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const result = teacherTool.evalResults[criteriaInstanceId];
                        const label = getTemplateStringFromCriteriaInstanceId(criteriaInstanceId);
                        return (
                            label && (
                                <div className="result-block-id" key={criteriaInstanceId}>
                                    <p className="block-id-label">
                                        {getTemplateStringFromCriteriaInstanceId(criteriaInstanceId)}:
                                    </p>
                                    {result === CriteriaEvaluationResult.InProgress && (
                                        <div className="common-spinner" />
                                    )}
                                    {result === CriteriaEvaluationResult.CompleteWithNoResult && <p>{lf("N/A")}</p>}
                                    {result === CriteriaEvaluationResult.Fail && (
                                        <p className="negative-text">{lf("Needs Work")}</p>
                                    )}
                                    {result === CriteriaEvaluationResult.Pass && (
                                        <p className="positive-text">{lf("Looks Good!")}</p>
                                    )}
                                </div>
                            )
                        );
                    })}
                </div>
            )}
        </>
    );
};
