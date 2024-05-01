import { useContext } from "react";
import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { setChecklistName } from "../transforms/setChecklistName";
import { DebouncedInput } from "./DebouncedInput";
import { AddCriteriaButton } from "./AddCriteriaButton";
import css from "./styling/ActiveChecklistDisplay.module.scss";
import React from "react";
import { CriteriaTable } from "./CriteriaTable";

interface ActiveChecklistDisplayProps {}
export const ActiveChecklistDisplay: React.FC<ActiveChecklistDisplayProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className={css["checklist-display"]}>
            <div className={css["checklist-name-input-container"]}>
                <DebouncedInput
                    label={Strings.Name}
                    ariaLabel={Strings.Name}
                    onChange={setChecklistName}
                    placeholder={Strings.ChecklistName}
                    initialValue={teacherTool.checklist.name}
                    preserveValueOnBlur={true}
                    className={css["checklist-name-input"]}
                />
            </div>
            <CriteriaTable />
            <AddCriteriaButton />
        </div>
    );
};
