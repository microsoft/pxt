/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { setRubricName } from "../transforms/setRubricName";
import { DebouncedInput } from "./DebouncedInput";
import { AddCriteriaButton } from "./AddCriteriaButton";
import css from "./styling/ActiveRubricDisplay.module.scss";
import { CriteriaInstance } from "../types/criteria";

// TODO thsparks - move to different file or keep here?
interface CriteriaInstanceDisplayProps {
    criteriaInstance: CriteriaInstance;
}
const CriteriaInstanceDisplay: React.FC<CriteriaInstanceDisplayProps> = ({ criteriaInstance }) => {
    const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
    if (!catalogCriteria) {
        return null;
    }

    return catalogCriteria ? (
        <tr className={css["criteria-instance-display"]}>
            <td className={css["criteria-display-text"]}>{catalogCriteria.template}</td>
            <td>
                <Button
                    className={css["criteria-btn-remove"]}
                    label={lf("X")}
                    onClick={() => removeCriteriaFromRubric(criteriaInstance)}
                    title={lf("Remove")}
                />
            </td>
        </tr>
    ) : null;
};

interface IProps {}
export const ActiveRubricDisplay: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className={css["rubric-display"]}>
            <DebouncedInput
                label={lf("Name")}
                ariaLabel={lf("Name")}
                onChange={setRubricName}
                placeholder={lf("Rubric Name")}
                initialValue={teacherTool.rubric.name}
                preserveValueOnBlur={true}
                className={css["rubric-name-input"]}
            />
            <table className={css["criteria-table"]}>
                <thead>
                    <tr>
                        <th>{lf("Criteria")}</th>
                        <th>
                            <i className={"fas fa-ellipsis-v"} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {teacherTool.rubric.criteria?.map(criteriaInstance => {
                        if (!criteriaInstance) return null;
                        return (
                            <CriteriaInstanceDisplay
                                criteriaInstance={criteriaInstance}
                                key={criteriaInstance.instanceId}
                            />
                        );
                    })}
                </tbody>
            </table>
            <AddCriteriaButton />
        </div>
    );
};
