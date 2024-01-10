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
                    {teacherTool.currentEvalResult === undefined && <div className="common-spinner" />}
                    {teacherTool.currentEvalResult?.passed === true && <h4 style={{ color: "green" }}>Passed!</h4>}
                    {teacherTool.currentEvalResult?.passed === false && <h4 style={{ color: "red" }}>Failed!</h4>}
                </div>
            )}
        </>
    );

};

export default EvalResultDisplay;
