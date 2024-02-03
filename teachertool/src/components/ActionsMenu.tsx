import { useContext } from "react";
import { MenuDropdown, MenuItem } from "react-common/components/controls/MenuDropdown";
import { writeRubricToFile } from "../services/fileSystemService";
import { AppStateContext } from "../state/appStateContext";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ActionsMenu.module.scss";
import { showModal } from "../transforms/showModal";

export interface IProps {}

export const ActionsMenu: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleImportRubricClicked() {
        showModal("import-rubric");
    }

    function handleExportRubricClicked() {
        writeRubricToFile(teacherTool.rubric);
    }

    const menuItems: MenuItem[] = [
        {
            id: "import-rubric",
            title: lf("Import Rubric"),
            label: lf("Import Rubric"),
            ariaLabel: lf("Import Rubric"),
            onClick: handleImportRubricClicked
        },
        {
            id: "export-rubric",
            title: lf("Export Rubric"),
            label: lf("Export Rubric"),
            ariaLabel: lf("Export Rubric"),
            onClick: handleExportRubricClicked
        }
    ]

    const dropdownLabel = <i className={"fas fa-ellipsis-v"} />
    return <MenuDropdown id="actions-menu" className={css["actions-menu"]} items={menuItems} title={"Actions"} label={dropdownLabel} />
};
