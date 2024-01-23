/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";

interface IProps {}

const EvalResultDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <>
            {teacherTool.projectMetadata && (
                <div className="eval-results-container">
                    <h3>{lf("Project: {0}", teacherTool.projectMetadata.name)}</h3>
                    {teacherTool.currentEvalResult === undefined && <div className="common-spinner" />}
                    {Object.keys(teacherTool.currentEvalResult?.criteriaResults ?? {}).map((id) => {
                        const result = teacherTool.currentEvalResult?.criteriaResults[id];
                        const criteriaInstance = teacherTool.selectedCriteria?.find((criteria) => criteria.instanceId === id);
                        const catalogCriteria = teacherTool.catalog?.find((criteria) => criteria.id === criteriaInstance?.catalogCriteriaId);
                        return catalogCriteria ? (
                            <div className="result-block-id" key={id}>
                                <p className="block-id-label">{catalogCriteria?.template}:</p>
                                <p className={result ? "positive-text" : "negative-text"}>{result ? "passed" : "failed"}</p>
                            </div>
                        ) : null;
                    })}
                </div>
            )}
        </>
    );

};

export default EvalResultDisplay;
