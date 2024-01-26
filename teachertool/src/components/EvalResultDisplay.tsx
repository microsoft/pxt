/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";

interface IProps {}

const EvalResultDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    function getTemplateFromCriteriaInstanceId(instanceId: string): string {
        const catalogCriteriaId = teacherTool.selectedCriteria?.find(
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
                    {teacherTool.currentEvalResult === undefined && <div className="common-spinner" />}
                    {Object.keys(teacherTool.currentEvalResult?.results ?? {}).map(id => {
                        const result = teacherTool.currentEvalResult?.results[id];
                        return (
                            <div className="result-block-id" key={id}>
                                <p className="block-id-label">{getTemplateFromCriteriaInstanceId(id)}:</p>
                                <p className={result ? "positive-text" : "negative-text"}>
                                    {result ? "passed" : "failed"}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default EvalResultDisplay;
