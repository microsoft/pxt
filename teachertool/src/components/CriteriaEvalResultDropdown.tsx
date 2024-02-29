import * as React from "react";
import { useMemo } from "react";
import { setEvalResultOutcome } from "../transforms/setEvalResultOutcome";
import { Dropdown, DropdownItem } from "react-common/components/controls/Dropdown";
import { CriteriaEvaluationResult } from "../types/criteria";
import css from "./styling/EvalResultDisplay.module.scss";

interface CriteriaEvalResultProps {
    result: CriteriaEvaluationResult;
    criteriaId: string;
}

const itemIdToCriteriaResult: pxt.Map<CriteriaEvaluationResult> = {
    "evaluating": CriteriaEvaluationResult.InProgress,
    "notevaluated": CriteriaEvaluationResult.CompleteWithNoResult,
    "fail": CriteriaEvaluationResult.Fail,
    "pass": CriteriaEvaluationResult.Pass,
}

const criteriaResultToItemId: pxt.Map<string> = {
    [CriteriaEvaluationResult.InProgress]: "evaluating",
    [CriteriaEvaluationResult.CompleteWithNoResult]: "notevaluated",
    [CriteriaEvaluationResult.Fail]: "fail",
    [CriteriaEvaluationResult.Pass]: "pass",
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
    }
]

export const CriteriaEvalResultDropdown: React.FC<CriteriaEvalResultProps> = ({ result, criteriaId }) => {
    const selectedResult = useMemo(() => criteriaResultToItemId[result], [result]);

    return (
        <Dropdown
            id="project-eval-result-dropdown"
            selectedId={selectedResult}
            className="rounded"
            items={dropdownItems}
            onItemSelected={(id) => setEvalResultOutcome(criteriaId, itemIdToCriteriaResult[id])}
        />
    )
}