/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { setRubricName } from "../transforms/setRubricName";
import { DebouncedInput } from "./DebouncedInput";
import { AddCriteriaButton } from "./AddCriteriaButton";
import css from "./styling/ActiveRubricDisplay.module.scss";
import React from "react";
import { CriteriaTable } from "./CriteriaTable";

interface ActiveRubricDisplayProps {}
export const ActiveRubricDisplay: React.FC<ActiveRubricDisplayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className={css["rubric-display"]}>
            <DebouncedInput
                label={Strings.Name}
                ariaLabel={Strings.Name}
                onChange={setRubricName}
                placeholder={Strings.RubricName}
                initialValue={teacherTool.rubric.name}
                preserveValueOnBlur={true}
                className={css["rubric-name-input"]}
            />
            <CriteriaTable />
            <AddCriteriaButton />
        </div>
    );
};
