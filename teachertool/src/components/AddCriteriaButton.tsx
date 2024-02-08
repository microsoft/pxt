/// <reference path="../../../built/pxtblocks.d.ts"/>

import { getSelectableCatalogCriteria } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { showModal } from "../transforms/showModal";
import { AppStateContext } from "../state/appStateContext";
import { useContext, useMemo } from "react";

interface IProps {}

export const AddCriteriaButton: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const hasAvailableCriteria = useMemo<boolean>(
        () => getSelectableCatalogCriteria(teacherTool).length > 0,
        [teacherTool.catalog, teacherTool.rubric]
    );
    return (
        <Button
            className="inline"
            label={lf("Add Criteria")}
            onClick={() => showModal("catalog-display")}
            title={lf("Add Criteria")}
            leftIcon="fas fa-plus-circle"
            disabled={!hasAvailableCriteria}
        />
    );
};
