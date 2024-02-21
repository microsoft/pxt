/// <reference path="../../../built/pxtblocks.d.ts"/>

import { useContext } from "react";
import { Strings } from "../constants";
import { AppStateContext } from "../state/appStateContext";
import { getCatalogCriteriaWithId } from "../state/helpers";
import { removeCriteriaFromRubric } from "../transforms/removeCriteriaFromRubric";
import { CriteriaInstance } from "../types/criteria";
import { classList } from "react-common/components/util";
import { Button } from "react-common/components/controls/Button";
import css from "./styling/CriteriaTable.module.scss";
import React from "react";

interface CriteriaActionMenuProps {
    criteriaInstance: CriteriaInstance;
}
const CriteriaActionMenu: React.FC<CriteriaActionMenuProps> = ({ criteriaInstance }) => {
    return (
        <div className={css["criteria-action-menu"]}>
            <Button
                label={<i className="far fa-trash-alt" />}
                title={Strings.Remove}
                ariaLabel={Strings.Remove}
                onClick={() => removeCriteriaFromRubric(criteriaInstance)}
            />
        </div>
    );
};

interface CriteriaInstanceDisplayProps {
    criteriaInstance: CriteriaInstance;
}
const CriteriaInstanceDisplay: React.FC<CriteriaInstanceDisplayProps> = ({ criteriaInstance }) => {
    const catalogCriteria = getCatalogCriteriaWithId(criteriaInstance.catalogCriteriaId);
    if (!catalogCriteria) {
        return null;
    }

    return catalogCriteria ? (
        <div className={css["criteria-instance-display"]} role="row" tabIndex={0}>
            <div className={classList(css["cell"], css["criteria-text-cell"])} role="cell">
                {catalogCriteria.template}
            </div>
            <div className={classList(css["cell"], css["criteria-action-menu-cell"])} role="cell">
                <CriteriaActionMenu criteriaInstance={criteriaInstance} />
            </div>
        </div>
    ) : null;
};

interface CriteriaTableProps {}
const CriteriaTableControl: React.FC<CriteriaTableProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return teacherTool.rubric.criteria && teacherTool.rubric.criteria.length > 0 ? (
                <div className={css["criteria-table"]} role="table" aria-label={Strings.Criteria}>
                    <div className={css["criteria-header"]} role="row">
                        <div className={classList(css["cell"], css["criteria-text-cell"])} role="columnheader">
                            {Strings.Criteria}
                        </div>
                        <div className={classList(css["cell"], css["criteria-action-menu-cell"])} role="columnheader">
                            {/* Intentionally left empty */}
                        </div>
                    </div>
                    <div className={css["criteria-table-body"]}>
                        {teacherTool.rubric.criteria.map(criteriaInstance => {
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
            ) : null;
};

export const CriteriaTable = Object.assign(CriteriaTableControl, {
    CriteriaInstanceDisplay,
    CriteriaActionMenu
});
