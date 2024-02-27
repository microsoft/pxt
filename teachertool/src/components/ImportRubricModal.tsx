import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { getRubricFromFileAsync } from "../transforms/getRubricFromFileAsync";
import { Rubric } from "../types/rubric";
import { setRubric } from "../transforms/setRubric";
import { DragAndDropFileSurface } from "./DragAndDropFileSurface";
import { Strings } from "../constants";
import css from "./styling/ImportRubricModal.module.scss";
import { isRubricLoaded } from "../state/helpers";
import { confirmAsync } from "../transforms/confirmAsync";

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
            setErrorMessage(lf("Invalid rubric file."));
        } else {
            setErrorMessage(undefined);

            // TODO thsparks - set parsedRubric in app state as a "Pending Rubric" and open a whole new modal, which can also be used with the New Rubric command?

            if (isRubricLoaded(teacherTool)) {
                if (!(await confirmAsync(Strings.ConfirmReplaceRubricMsg))) {
                    return;
                }

                setRubric(parsedRubric);
                closeModal();
            }
        }
    }

    return teacherTool.modal === "import-rubric" ? (
        <Modal title={Strings.ImportRubric} onClose={closeModal}>
            <div className={css["import-rubric"]}>
                <DragAndDropFileSurface onFileDroppedAsync={handleFileDroppedAsync} errorMessage={errorMessage} />
            </div>
        </Modal>
    ) : null;
};
