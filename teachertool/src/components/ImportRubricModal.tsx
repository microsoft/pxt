import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
// eslint-disable-next-line import/no-internal-modules
import css from "./styling/ImportRubricModal.module.scss";
import { getRubricFromFileAsync } from "../transforms/getRubricFromFileAsync";
import { NoticeLabel } from "./NoticeLabel";
import { Rubric } from "../types/rubric";
import { RubricPreview } from "./RubricPreview";
import { setRubric } from "../transforms/setRubric";

export interface IProps {}

export const ImportRubricModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [selectedRubric, setSelectedRubric] = useState<Rubric | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    useEffect(() => {
        async function updatePreview(file: File) {
            const parsedRubric = await getRubricFromFileAsync(file, false /* allow partial */);
            if (!parsedRubric) {
                setErrorMessage(lf("Invalid rubric file."));
            } else {
                setErrorMessage(undefined);
            }
            setSelectedRubric(parsedRubric);
        }

        if (selectedFile) {
            updatePreview(selectedFile);
        } else {
            setSelectedRubric(undefined);
            setErrorMessage(undefined);
        }
    }, [selectedFile]);

    function closeModal() {
        setSelectedFile(undefined);
        setErrorMessage(undefined);
        setSelectedRubric(undefined);
        hideModal("import-rubric");
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        } else {
            setSelectedFile(undefined);
        }
    }

    function handleImportClicked() {
        if (selectedRubric) {
            setRubric(selectedRubric);
        }

        closeModal();
    }

    const actions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: closeModal,
        },
        {
            label: lf("Import"),
            className: "primary",
            onClick: handleImportClicked,
            disabled: !selectedRubric,
        },
    ];

    return teacherTool.modal === "import-rubric" ? (
        <Modal title={lf("Select rubric to import")} actions={actions} onClose={closeModal}>
            <div className={css["import-rubric"]}>
                <NoticeLabel severity="warning">
                    {lf("Warning! Your current rubric will be overwritten by the imported rubric.")}
                </NoticeLabel>
                {errorMessage && <NoticeLabel severity="error">{errorMessage}</NoticeLabel>}
                {selectedRubric && (
                    <div className={css["rubric-preview-container"]}>
                        <RubricPreview rubric={selectedRubric} />
                    </div>
                )}
                <input
                    type="file"
                    tabIndex={0}
                    autoFocus
                    aria-label={lf("Select rubric file.")}
                    onChange={handleFileChange}
                />
            </div>
        </Modal>
    ) : null;
};
