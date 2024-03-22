import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { Strings } from "../constants";

export interface IProps {}
export const ConfirmationModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleCancel() {
        hideModal();
        teacherTool.confirmationOptions?.onCancel?.();
    }

    function handleContinue() {
        hideModal();
        teacherTool.confirmationOptions?.onContinue?.();
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

    return teacherTool.modal === "confirmation" && teacherTool.confirmationOptions ? (
        <Modal title={teacherTool.confirmationOptions.title} onClose={handleCancel} actions={actions}>
            {teacherTool.confirmationOptions.message}
        </Modal>
    ) : null;
};
