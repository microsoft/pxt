import * as React from "react";
import { useContext } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { CriteriaResultEntry } from "./CriteriaResultEntry";
import { QRCodeSVG } from "qrcode.react";
import { getProjectLink } from "../utils";

const ResultsHeader: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className={css["header"]}>
            <div className={css["checklist-name"]}>
                <h2>{teacherTool.checklist.name}</h2>
            </div>
            <div className={css["project-details"]}>
                <div className={css["project-text"]}>
                    <h3>{teacherTool?.projectMetadata?.name}</h3>
                    <p>{getProjectLink(teacherTool.projectMetadata?.inputText!)}</p>
                </div>
                <div className={css["project-qrcode"]}>
                    <QRCodeSVG size={60} value={getProjectLink(teacherTool.projectMetadata?.inputText!)} />
                </div>
            </div>
        </div>
    );
};

interface EvalResultDisplayProps {
    resultsRef: React.RefObject<HTMLDivElement>;
}

export const EvalResultDisplay: React.FC<EvalResultDisplayProps> = ({ resultsRef }) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <>
            {teacherTool.projectMetadata && (
                <div className={css["eval-results-container"]} ref={resultsRef}>
                    <ResultsHeader />
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        return <CriteriaResultEntry criteriaId={criteriaInstanceId} key={criteriaInstanceId} />;
                    })}
                </div>
            )}
        </>
    );
};
