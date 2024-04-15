import * as React from "react";
import { useMemo } from "react";
import { setEvalResultOutcome } from "../transforms/setEvalResultOutcome";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { EvaluationStatus } from "../types/criteria";
import { classList } from "react-common/components/util";
import css from "./styling/EvalResultDisplay.module.scss";

interface CriteriaEvalResultProps {
    result: EvaluationStatus;
    criteriaId: string;
}

const itemIdToCriteriaResult: pxt.Map<EvaluationStatus> = {
    notevaluated: EvaluationStatus.CompleteWithNoResult,
    fail: EvaluationStatus.Fail,
    pass: EvaluationStatus.Pass,
    notstarted: EvaluationStatus.NotStarted,
};

const criteriaResultToItemId: pxt.Map<string> = {
    [EvaluationStatus.CompleteWithNoResult]: "notevaluated",
    [EvaluationStatus.Fail]: "fail",
    [EvaluationStatus.Pass]: "pass",
    [EvaluationStatus.NotStarted]: "notstarted",
};

const dropdownItems: DropdownItem[] = [
    {
        id: "notevaluated",
        title: lf("not applicable"),
        label: lf("N/A"),
    },
    {
        id: "fail",
        title: lf("needs work"),
        label: lf("Needs work"),
    },
    {
        id: "pass",
        title: lf("looks good!"),
        label: lf("Looks good!"),
    },
    {
        id: "notstarted",
        title: lf("not started"),
        label: lf("Not started"),
    },
];

export const CriteriaEvalResultDropdown: React.FC<CriteriaEvalResultProps> = ({ result, criteriaId }) => {
    const selectedResult = useMemo(() => criteriaResultToItemId[result], [result]);

    return (
        <Dropdown
            id="project-eval-result-dropdown"
            selectedId={selectedResult}
            className={classList(
                "rounded",
                selectedResult,
                selectedResult === "notevaluated" ? css["no-print"] : undefined
            )}
            items={dropdownItems}
            onItemSelected={id => setEvalResultOutcome(criteriaId, itemIdToCriteriaResult[id])}
        />
    );
};
