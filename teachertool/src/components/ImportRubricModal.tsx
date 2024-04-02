import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { getRubricFromFileAsync } from "../transforms/getRubricFromFileAsync";
import { DragAndDropFileSurface } from "./DragAndDropFileSurface";
import { Strings } from "../constants";
import css from "./styling/ImportRubricModal.module.scss";
import { replaceActiveRubricAsync } from "../transforms/replaceActiveRubricAsync";

export interface IProps {}

export const ImportRubricModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    function closeModal() {
        setErrorMessage(undefined);
        hideModal();
    }

    async function handleFileDroppedAsync(file: File) {
        const parsedRubric = await getRubricFromFileAsync(file, false /* allow partial */);
        if (!parsedRubric) {
            setErrorMessage(Strings.InvalidRubricFile);
        } else {
            setErrorMessage(undefined);
            closeModal();
            replaceActiveRubricAsync(parsedRubric);
        }
    }

    return teacherTool.modalOptions?.modal === "import-rubric" ? (
        <Modal title={Strings.ImportRubric} onClose={closeModal} className={css["import-rubric-modal"]}>
            <div className={css["import-rubric"]}>
                <DragAndDropFileSurface onFileDroppedAsync={handleFileDroppedAsync} errorMessage={errorMessage} />
            </div>
        </Modal>
    ) : null;
};
