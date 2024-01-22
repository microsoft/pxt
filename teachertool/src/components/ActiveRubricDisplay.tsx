/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../utils";
import { Button } from "react-common/components/controls/Button";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";

interface IProps {}

const ActiveRubricDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className="rubric-display">
            <h3>{lf("Rubric")}</h3>
            {teacherTool.selectedCriteria?.map(criteriaInstance => {
                const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);

                return criteriaInstance?.catalogCriteriaId && (
                        <div className="criteria-instance-display" id={`criteriaInstance${criteriaInstance.instanceId}`}>
                            {catalogCriteria?.template}
                            <Button
                                id={`btnRemove${criteriaInstance.instanceId}`}
                                className="criteria-btn-remove"
                                label={lf("X")}
                                onClick={() => removeCriteriaFromRubric(criteriaInstance)}
                                title={lf("Remove")} />
                        </div>
                );
            })}
        </div>
    );
};

export default ActiveRubricDisplay;
