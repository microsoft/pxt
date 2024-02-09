/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { setRubricName } from "../transforms/setRubricName";
import { DebouncedInput } from "./DebouncedInput";
import { AddCriteriaButton } from "./AddCriteriaButton";
import { CriteriaInstanceDisplay } from "./CriteriaInstanceDisplay";

interface IProps {}

export const ActiveRubricDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className="rubric-display">
            <DebouncedInput
                label={lf("Rubric Name")}
                ariaLabel={lf("Rubric Name")}
                onChange={setRubricName}
                placeholder={lf("Rubric Name")}
                initialValue={teacherTool.rubric.name}
                preserveValueOnBlur={true}
            />
            {teacherTool.rubric.criteria?.map(criteriaInstance => {
                if (!criteriaInstance) return null;
                return <CriteriaInstanceDisplay key={criteriaInstance.instanceId} criteriaInstance={criteriaInstance} />;
            })}
            <AddCriteriaButton />
        </div>
    );
};
