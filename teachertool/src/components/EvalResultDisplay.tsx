import * as React from "react";
import { useState, useContext, useEffect } from "react";
import css from "./styling/EvalResultDisplay.module.scss";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { CriteriaEvaluationResult } from "../types/criteria";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { Strings, Ticks } from "../constants";
import { Input } from "react-common/components/controls/Input";
import { MenuDropdown, MenuDropdownProps, MenuItem } from "react-common/components/controls/MenuDropdown";


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
                <h3>{lf("{0}",teacherTool.rubric.name)}</h3>
            </div>
            <div className={css["project-details"]}>
                <h4>{lf("{0}", teacherTool?.projectMetadata?.name)}</h4>
                <p>{getProjectLink()}</p>
            </div>
        </div>
    );
};

interface AddNotesButtonProps {
    criteriaId: string;
    setShowInput: (show: boolean) => void;
}

const AddNotesButton: React.FC<AddNotesButtonProps> = ({ criteriaId, setShowInput }) => {
    const onAddNotesClicked = async () => {
        pxt.tickEvent(Ticks.AddResultNotes, { criteriaId });
        setShowInput(true);
    };
    return (
        <Button
            className={classList("inline", "add-button")}
            label={Strings.AddNotes}
            onClick={onAddNotesClicked}
            title={Strings.AddNotes}
            leftIcon="fas fa-plus-circle"
        />
    );
}

const CriteriaResultNotes: React.FC<{}> = () => {
    return (
        <div>
            <Input
                placeholder={lf("Write your notes here")}
                ariaLabel={lf("Notes regarding the criteria result")}
                preserveValueOnBlur={true}
                autoComplete={false}
            />
        </div>
    )
}

interface CriteriaEvalResultProps {
    result: CriteriaEvaluationResult;
    criteriaId: string;
}

const CriteriaEvalResult: React.FC<CriteriaEvalResultProps> = ({ result, criteriaId }) => {
    // Q: if we change the criteria's evaluated result here, do we want to change it in the state, too
    const [selectedResult, setSelectedResult] = useState(result);

    useEffect(() => {
        setSelectedResult(result);
    }, [result]);

    const items: MenuItem[] = [
        {
            title: CriteriaEvaluationResult.InProgress,
            label: CriteriaEvaluationResult.InProgress,
            ariaLabel: CriteriaEvaluationResult.InProgress,
            onClick: () => setSelectedResult(CriteriaEvaluationResult.InProgress),
        },
        {
            title: CriteriaEvaluationResult.CompleteWithNoResult,
            label: CriteriaEvaluationResult.CompleteWithNoResult,
            ariaLabel: CriteriaEvaluationResult.CompleteWithNoResult,
            onClick: () => setSelectedResult(CriteriaEvaluationResult.CompleteWithNoResult),
        },
        {
            title: CriteriaEvaluationResult.Fail,
            label: CriteriaEvaluationResult.Fail,
            ariaLabel: CriteriaEvaluationResult.Fail,
            onClick: () => setSelectedResult(CriteriaEvaluationResult.Fail),
        },
        {
            title: CriteriaEvaluationResult.Pass,
            label: CriteriaEvaluationResult.Pass,
            ariaLabel: CriteriaEvaluationResult.Pass,
            onClick: () => setSelectedResult(CriteriaEvaluationResult.Pass),
        },
    ]
    return (
        <div>
            <MenuDropdown
                title="hello"
                label={selectedResult}
                items={items}
            />
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
}

interface CriteriaResultEntryProps {
    criteriaId: string;
    result: CriteriaEvaluationResult;
    label: string;
}

const CriteriaResultEntry: React.FC<CriteriaResultEntryProps> = ({ criteriaId, result, label }) => {
    const [showInput, setShowInput] = useState(false);
    return (
        <div className={css["result-block-id"]} key={criteriaId}>
            <p className={css["block-id-label"]}>
                {label}:
            </p>
            <CriteriaEvalResult result={result} criteriaId={criteriaId} />
            {!showInput && <AddNotesButton criteriaId={criteriaId} setShowInput={setShowInput} />}
            {showInput && <CriteriaResultNotes />}
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
                    {Object.keys(teacherTool.evalResults ?? {}).map(criteriaInstanceId => {
                        const label = getTemplateStringFromCriteriaInstanceId(criteriaInstanceId);
                        return (
                            label &&
                            <CriteriaResultEntry
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
