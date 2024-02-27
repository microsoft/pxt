import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult } from "../types/criteria";
import css from "./styling/EvalResultDisplay.module.scss";
import { classList } from "react-common/components/util";


interface IProps {}

const ResultsHeader: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    return (
        <>
            <h1>{teacherTool.rubric.name}</h1>
        </>
    );
};

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
                <div className={classList(css["eval-results-container"])}>
                    <h3>{lf("Project: {0}", teacherTool.projectMetadata.name)}</h3>

                    {teacherTool.evalResults.length === 0 && <div className={css["common-spinner"]} />}
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const result = teacherTool.evalResults[criteriaInstanceId];
                        const label = getTemplateStringFromCriteriaInstanceId(criteriaInstanceId);
                        return (
                            label && (
                                <div className={css["result-block-id"]} key={criteriaInstanceId}>
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
                                </div>
                            )
                        );
                    })}
                </div>
            )}
        </>
    );
};
