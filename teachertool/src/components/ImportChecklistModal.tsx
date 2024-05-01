import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { getChecklistFromFileAsync } from "../transforms/getChecklistFromFileAsync";
import { DragAndDropFileSurface } from "./DragAndDropFileSurface";
import { Strings } from "../constants";
import css from "./styling/ImportChecklistModal.module.scss";
import { replaceActiveChecklistAsync } from "../transforms/replaceActiveChecklistAsync";

export interface IProps {}

export const ImportChecklistModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    function closeModal() {
        setErrorMessage(undefined);
        hideModal();
    }

    async function handleFileDroppedAsync(file: File) {
        const parsedChecklist = await getChecklistFromFileAsync(file, false /* allow partial */);
        if (!parsedChecklist) {
            setErrorMessage(Strings.InvalidChecklistFile);
        } else {
            setErrorMessage(undefined);
            closeModal();
            replaceActiveChecklistAsync(parsedChecklist);
        }
    }

    return teacherTool.modalOptions?.modal === "import-checklist" ? (
        <Modal title={Strings.ImportChecklist} onClose={closeModal} className={css["import-checklist-modal"]}>
            <div className={css["import-checklist"]}>
                <DragAndDropFileSurface onFileDroppedAsync={handleFileDroppedAsync} errorMessage={errorMessage} />
            </div>
        </Modal>
    ) : null;
};
