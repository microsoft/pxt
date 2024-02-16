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
import { classList } from "react-common/components/util";
import { MenuItem } from "react-common/components/controls/MenuDropdown";
import { Strings } from "../constants";
import { Toolbar } from "./Toolbar";

interface CriteriaActionMenuProps {
    criteriaInstance: CriteriaInstance | undefined;
}
const CriteriaActionMenu: React.FC<CriteriaActionMenuProps> = ({criteriaInstance}) => {
    const actions: MenuItem[] = criteriaInstance ? [
        {
            title: Strings.Remove,
            label: Strings.Remove,
            ariaLabel: Strings.Remove,
            onClick: () => removeCriteriaFromRubric(criteriaInstance),
        }
    ] : [];

    return (
        <div className={css["criteria-action-menu"]}>
            <Toolbar.MenuDropdown title={lf("More Actions")} items={actions} disabled={!actions.length} />
        </div>
    );
}

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
        <div className={css["criteria-instance-display"]}>
            <div className={classList(css["cell"], css["criteria-text-cell"])}>{catalogCriteria.template}</div>
            <div className={classList(css["cell"], css["criteria-action-menu-cell"])}>
                <CriteriaActionMenu criteriaInstance={criteriaInstance} />
            </div>
        </div>
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
            <div className={css["criteria-table"]}>
                <div className={css["criteria-header"]}>
                    <div className={classList(css["cell"], css["criteria-text-cell"])}>{lf("Criteria")}</div>
                    <div className={classList(css["cell"], css["criteria-action-menu-cell"])}>
                        <CriteriaActionMenu criteriaInstance={undefined} />
                    </div>
                </div>
                <div className={css["criteria-table-body"]}>
                    {teacherTool.rubric.criteria?.map(criteriaInstance => {
                        if (!criteriaInstance) return null;
                        return (
                            <CriteriaInstanceDisplay
                                criteriaInstance={criteriaInstance}
                                key={criteriaInstance.instanceId}
                            />
                        );
                    })}
                </div>
            </div>
            <AddCriteriaButton />
        </div>
    );
};
