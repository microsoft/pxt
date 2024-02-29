import * as React from "react";
import { useMemo } from "react";
import { setEvalResultOutcome } from "../transforms/setEvalResultOutcome";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { CriteriaEvaluationResult } from "../types/criteria";
import css from "./styling/EvalResultDisplay.module.scss";
import { classList } from "react-common/components/util";

interface CriteriaEvalResultProps {
    result: CriteriaEvaluationResult;
    criteriaId: string;
}

const itemIdToCriteriaResult: pxt.Map<CriteriaEvaluationResult> = {
    "evaluating": CriteriaEvaluationResult.InProgress,
    "notevaluated": CriteriaEvaluationResult.CompleteWithNoResult,
    "fail": CriteriaEvaluationResult.Fail,
    "pass": CriteriaEvaluationResult.Pass,
    "pending": CriteriaEvaluationResult.Pending
}

const criteriaResultToItemId: pxt.Map<string> = {
    [CriteriaEvaluationResult.InProgress]: "evaluating",
    [CriteriaEvaluationResult.CompleteWithNoResult]: "notevaluated",
    [CriteriaEvaluationResult.Fail]: "fail",
    [CriteriaEvaluationResult.Pass]: "pass",
    [CriteriaEvaluationResult.Pending]: "pending"
}

const dropdownItems: DropdownItem[] = [
    {
        id: "evaluating",
        title: lf("evaluating..."),
        label: lf("evaluating..."),
    },
    {
        id: "notevaluated",
        title: lf("not evaluated"),
        label: lf("not evaluated"),
    },
    {
        id: "fail",
        title: lf("needs work"),
        label: lf("needs work"),

    },
    {
        id: "pass",
        title: lf("looks good!"),
        label: lf("looks good!"),
    },
    {
        id: "pending",
        title: lf("not started"),
        label: lf("not started"),
    },
]

export const CriteriaEvalResultDropdown: React.FC<CriteriaEvalResultProps> = ({ result, criteriaId }) => {
    const selectedResult = useMemo(() => criteriaResultToItemId[result], [result]);

    return (
        <Dropdown
            id="project-eval-result-dropdown"
            selectedId={selectedResult}
            className={classList("rounded", selectedResult)}
            items={dropdownItems}
            onItemSelected={(id) => setEvalResultOutcome(criteriaId, itemIdToCriteriaResult[id])}
        />
    )
}