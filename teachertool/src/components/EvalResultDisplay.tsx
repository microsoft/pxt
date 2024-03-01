import * as React from "react";
import { useContext } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaResultEntry } from "./CriteriaResultEntry";
import { QRCodeSVG } from "qrcode.react"


const ResultsHeader: React.FC = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function getProjectLink(): string {
        const inputText = teacherTool.projectMetadata?.inputText!;
        const hasMakeCode = inputText?.indexOf("makecode") !== -1;
        return hasMakeCode ? inputText : `https://makecode.com/${inputText}`;
    }
    // TODO: change the headers to be the correct thing for html (not h3, h4)
    return (
        <div className={css["header"]}>
            <div className={css["rubric-name"]}>
                <h2>{teacherTool.rubric.name}</h2>
            </div>
            <div className={css["project-details"]}>
                <div className={css["project-text"]}>
                    <h3>{teacherTool?.projectMetadata?.name}</h3>
                    <p>{getProjectLink()}</p>
                </div>
                <div className={css["project-qrcode"]}>
                    <QRCodeSVG size={60} value={getProjectLink()} />
                </div>
            </div>
        </div>
    );
};


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
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const label = getTemplateStringFromCriteriaInstanceId(criteriaInstanceId);
                        return (
                            label &&
                            <CriteriaResultEntry
                                criteriaId={criteriaInstanceId}
                                result={teacherTool.evalResults[criteriaInstanceId].result}
                                label={label}
                            />
                        )
                    })}
                </div>
            )}
        </>
    );
};
