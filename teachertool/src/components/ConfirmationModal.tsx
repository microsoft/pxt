import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { Strings } from "../constants";
import { ConfirmationModalOptions } from "../types/modalOptions";

export interface IProps {}
export const ConfirmationModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [confirmationModalOptions, setConfirmationModalOptions] = useState<ConfirmationModalOptions | undefined>(
        undefined
    );

    useEffect(() => {
        if (teacherTool.modalOptions?.modal === "confirmation") {
            setConfirmationModalOptions(teacherTool.modalOptions as ConfirmationModalOptions);
        } else {
            setConfirmationModalOptions(undefined);
        }
    }, [teacherTool.modalOptions]);

    function handleCancel() {
        hideModal();
        confirmationModalOptions?.onCancel?.();
    }

    function handleContinue() {
        hideModal();
        confirmationModalOptions?.onContinue?.();
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

    return confirmationModalOptions ? (
        <Modal title={confirmationModalOptions.title} onClose={handleCancel} actions={actions}>
            {confirmationModalOptions.message}
        </Modal>
    ) : null;
};
