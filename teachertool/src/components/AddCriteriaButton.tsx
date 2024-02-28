import { getSelectableCatalogCriteria } from "../state/helpers";
import { Button } from "react-common/components/controls/Button";
import { showModal } from "../transforms/showModal";
import { AppStateContext } from "../state/appStateContext";
import { useContext, useMemo } from "react";
import { classList } from "react-common/components/util";
import { Strings } from "../constants";

interface IProps {}

export const AddCriteriaButton: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const hasAvailableCriteria = useMemo<boolean>(
        () => getSelectableCatalogCriteria(teacherTool).length > 0,
        [teacherTool.catalog, teacherTool.rubric]
    );
    return (
        <Button
            className={classList("inline", "add-button")}
            label={Strings.AddCriteria}
            onClick={() => showModal("catalog-display")}
            title={Strings.AddCriteria}
            leftIcon="fas fa-plus-circle"
            disabled={!hasAvailableCriteria}
        />
    );
};
