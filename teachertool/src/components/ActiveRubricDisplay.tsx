import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { showModal } from "../transforms/showModal";
import { setRubricName } from "../transforms/setRubricName";
import { DebouncedInput } from "./DebouncedInput";

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

                const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
                return (
                    criteriaInstance.catalogCriteriaId && (
                        <div className="criteria-instance-display" key={criteriaInstance.instanceId}>
                            {catalogCriteria?.template}
                            <Button
                                className="criteria-btn-remove"
                                label={lf("X")}
                                onClick={() => removeCriteriaFromRubric(criteriaInstance)}
                                title={lf("Remove")}
                            />
                        </div>
                    )
                );
            })}
            <Button
                className="inline"
                label={lf("+ Add Criteria")}
                onClick={() => showModal("catalog-display")}
                title={lf("Add Criteria")}
            />
        </div>
    );
};
