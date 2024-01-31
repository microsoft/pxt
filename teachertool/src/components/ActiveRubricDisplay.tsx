/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { showCatalogModal } from "../transforms/showCatalogModal";
import { Input } from "react-common/components/controls/Input";
import { setRubricName } from "../state/actions";

interface IProps {}

export const ActiveRubricDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const [inProgressName, setInProgressName] = useState(teacherTool.rubric.name);

    function handleConfirmName() {
        setRubricName(inProgressName);
    }

    return (
        <div className="rubric-display">
            <Input
                label={lf("Rubric Name")}
                onChange={setInProgressName}
                placeholder={lf("Rubric Name")}
                initialValue={inProgressName}
                onEnterKey={handleConfirmName}
                onBlur={handleConfirmName}
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
                className="btn-inline"
                label={lf("+ Add Criteria")}
                onClick={showCatalogModal}
                title={lf("Add Criteria")}
            />
        </div>
    );
};
