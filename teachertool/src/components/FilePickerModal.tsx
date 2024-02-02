import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/FilePickerModal.module.scss";
import { importRubricFromFile } from "../transforms/importRubricFromFile";

export interface IProps {}

export const FilePickerModal: React.FC<IProps> = () => {
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

        hideModal("file-picker")
    }

    const actions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: () => hideModal("file-picker"),
        },
        {
            label: lf("Import"),
            className: "primary",
            onClick: handleLoadClicked,
        },
    ];

    return teacherTool.modal === "file-picker" ? (
        <Modal title={lf("Import Rubric")} actions={actions}>
            <div className={css["file-picker"]}>
                {/* TODO thsparks : split into separate components, like WarningLabel (with a ! icon, maybe?) */}
                <label className="warning-label">{lf("Warning! Your current rubric will be overwritten by the imported rubric.")}</label>
                <label id="selectRubricToImport">{lf("Select a rubric file to import.")}</label>
                <input
                    type="file"
                    tabIndex={0}
                    autoFocus
                    aria-labelledby="selectRubricToImport"
                    onChange={handleFileChange}
                />
                {/* Rubric Preview */}
            </div>
        </Modal>
    ) : null;
};
