import * as React from "react";
import { useMemo } from "react";
import { setEvalResultOutcome } from "../transforms/setEvalResultOutcome";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { EvaluationStatus } from "../types/criteria";
import css from "./styling/EvalResultDisplay.module.scss";
import { classList } from "react-common/components/util";

interface CriteriaEvalResultProps {
    result: EvaluationStatus;
    criteriaId: string;
}

const itemIdToCriteriaResult: pxt.Map<EvaluationStatus> = {
    evaluating: EvaluationStatus.InProgress,
    notevaluated: EvaluationStatus.CompleteWithNoResult,
    fail: EvaluationStatus.Fail,
    pass: EvaluationStatus.Pass,
    pending: EvaluationStatus.Pending,
};

const criteriaResultToItemId: pxt.Map<string> = {
    [EvaluationStatus.InProgress]: "evaluating",
    [EvaluationStatus.CompleteWithNoResult]: "notevaluated",
    [EvaluationStatus.Fail]: "fail",
    [EvaluationStatus.Pass]: "pass",
    [EvaluationStatus.Pending]: "pending",
};

const dropdownItems: DropdownItem[] = [
    {
        id: "evaluating",
        title: lf("evaluating..."),
        label: lf("Evaluating..."),
    },
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
        id: "pending",
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
            className={classList("rounded", selectedResult)}
            items={dropdownItems}
            onItemSelected={id => setEvalResultOutcome(criteriaId, itemIdToCriteriaResult[id])}
        />
    );
};
