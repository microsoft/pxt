import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { Strings } from "../constants";
import { ConfirmationModalOptions } from "../types/modalOptions";

export interface IProps {}
export const ConfirmationModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [modalOptions, setModalOptions] = useState<ConfirmationModalOptions | undefined>(undefined);

    useEffect(() => {
        if (teacherTool.modalOptions && teacherTool.modalOptions.modal === "confirmation") {
            setModalOptions(teacherTool.modalOptions as ConfirmationModalOptions);
        } else {
            setModalOptions(undefined);
        }
    }, [teacherTool.modalOptions]);

    function handleCancel() {
        hideModal();
        modalOptions?.onCancel?.();
    }

    function handleContinue() {
        hideModal();
        modalOptions?.onContinue?.();
    }

    const actions = [
        {
            label: Strings.Cancel,
            className: "secondary",
            onClick: handleCancel,
        },
        {
            label: Strings.Continue,
            className: "primary",
            onClick: handleContinue,
        },
    ];

    return teacherTool.modal === "confirmation" && modalOptions ? (
        <Modal title={modalOptions.title} onClose={handleCancel} actions={actions}>
            {modalOptions.message}
        </Modal>
    ) : null;
};
