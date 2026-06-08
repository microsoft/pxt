import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/appStateContext";
import { useContext } from "react";
import { classList } from "react-common/components/util";
import { Strings } from "../constants";
import { setCatalogOpen } from "../transforms/setCatalogOpen";

interface IProps {}

export const AddCriteriaButton: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    const isSelected = !!teacherTool.catalogOpen;
    const onClick = () => setCatalogOpen(!isSelected);

    return (
        <Button
            className={classList("inline", "outline-button")}
            label={Strings.AddCriteria}
            onClick={onClick}
            title={Strings.AddCriteria}
            leftIcon="fas fa-plus-circle"
            rightIcon={isSelected ? "fas fa-check" : undefined}
        />
    );
};
