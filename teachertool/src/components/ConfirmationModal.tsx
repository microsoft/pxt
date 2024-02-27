import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { Modal } from "react-common/components/controls/Modal";
import { hideModal } from "../transforms/hideModal";
import { classList } from "react-common/components/util";
import { CautionLevel } from "../types";
import css from "./styling/ConfirmationModal.module.scss";

export type ConfirmationModalProps = {
    title: string;
    message: string;
    cautionLevel: CautionLevel;
    onCancel: () => void;
    onContinue: () => void;
};

// ConfirmationModalProps are passed in through app state, not as component props.
export interface IProps {}
export const ConfirmationModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    function handleCancel() {
        hideModal();
        teacherTool.confirmationProps?.onCancel?.();
    }

    function handleContinue() {
        hideModal();
        teacherTool.confirmationProps?.onContinue?.();
    }

    const actions = [
        {
            label: lf("Cancel"),
            className: "secondary",
            onClick: handleCancel,
        },
        {
            label: lf("Continue"),
            className: classList("primary", teacherTool.confirmationProps?.cautionLevel === "high" ? css["caution"] : undefined),
            onClick: handleContinue,
        },
    ];

    return teacherTool.modal === "confirmation" && teacherTool.confirmationProps ? (
        <Modal title={teacherTool.confirmationProps.title ?? ""} onClose={handleCancel} actions={actions} className={css["confirmation-modal"]}>
            {teacherTool.confirmationProps.message}
        </Modal>
    ) : null;
};
