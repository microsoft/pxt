import { useContext } from "react";
import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { removeCriteriaFromChecklist } from "../transforms/removeCriteriaFromChecklist";
import { CriteriaInstance } from "../types/criteria";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import { CriteriaInstanceDisplay } from "./CriteriaInstanceDisplay";
import { getReadableCriteriaTemplate } from "../utils";
import css from "./styling/CriteriaTable.module.scss";
import React from "react";

interface CriteriaInstanceDisplayProps {
    criteriaInstance: CriteriaInstance;
}
const CriteriaInstanceRow: React.FC<CriteriaInstanceDisplayProps> = ({ criteriaInstance }) => {
    const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
    if (!catalogCriteria) {
        return null;
    }

    return catalogCriteria ? (
        <div
            className={css["criteria-instance-display"]}
            role="row"
            title={getReadableCriteriaTemplate(catalogCriteria)}
        >
            <div className={classList(css["cell"], css["criteria-display-cell"])} role="cell">
                <CriteriaInstanceDisplay criteriaInstance={criteriaInstance} />
            </div>
            <div
                className={classList(css["cell"], css["criteria-action-menu-cell"])}
                role="cell"
                aria-label={Strings.Actions}
            >
                <Button
                    label={<i className="far fa-trash-alt" />}
                    className={css["delete-criteria-button"]}
                    title={Strings.Remove}
                    ariaLabel={Strings.Remove}
                    onClick={() => removeCriteriaFromChecklist(criteriaInstance)}
                />
            </div>
        </div>
    ) : null;
};

interface CriteriaTableProps {}
const CriteriaTableControl: React.FC<CriteriaTableProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return teacherTool.checklist.criteria?.length > 0 ? (
        <div className={css["criteria-table"]} role="table" aria-label={Strings.Criteria}>
            <div role="rowgroup">
                <div className={css["criteria-header"]} role="row">
                    <div className={classList(css["cell"], css["criteria-display-cell"])} role="columnheader">
                        {Strings.Criteria}
                    </div>
                    <div
                        className={classList(css["cell"], css["criteria-action-menu-cell"])}
                        role="columnheader"
                        aria-label={Strings.Actions}
                    >
                        {/* Intentionally left empty */}
                    </div>
                </div>
            </div>
            <div className={css["criteria-table-body"]} role="rowgroup">
                {teacherTool.checklist.criteria.map(criteriaInstance => {
                    return (
                        <CriteriaInstanceRow criteriaInstance={criteriaInstance} key={criteriaInstance.instanceId} />
                    );
                })}
            </div>
        </div>
    ) : null;
};

export const CriteriaTable = Object.assign(CriteriaTableControl, {
    CriteriaInstanceDisplay: CriteriaInstanceRow,
});
