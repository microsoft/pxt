import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ImportRubricModal.module.scss";
import { importRubricFromFile } from "../transforms/importRubricFromFile";
import { NoticeLabel } from "./NoticeLabel";

export interface IProps {}

export const ImportRubricModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        } else {
            setSelectedFile(undefined);
        }
    }

    function handleLoadClicked() {
        if (selectedFile) {
            importRubricFromFile(selectedFile);
        }

        hideModal("import-rubric")
    }

    const actions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: () => hideModal("import-rubric"),
        },
        {
            label: lf("Import"),
            className: "primary",
            onClick: handleLoadClicked,
        },
    ];

    return teacherTool.modal === "import-rubric" ? (
        <Modal title={lf("Import Rubric")} actions={actions} onClose={() => hideModal("import-rubric")}>
            <div className={css["import-rubric"]}>
                <NoticeLabel severity="warning">{lf("Warning! Your current rubric will be overwritten by the imported rubric.")}</NoticeLabel>
                <label id="selectRubricToImport">{lf("Select a rubric file to import.")}</label>
                <input
                    type="file"
                    tabIndex={0}
                    autoFocus
                    aria-labelledby="selectRubricToImport"
                    onChange={handleFileChange}
                />
                {/* Rubric Preview - perhaps a component that takes in a Rubric prop? */}
            </div>
        </Modal>
    ) : null;
};
