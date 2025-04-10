import * as React from "react";
import { Modal } from "../controls/Modal"

export interface ImportModalProps {
    onCancelClick: () => void;
    onDeleteClick: (url: string) => void;
    ns: string;
}

export const DeleteConfirmationModal = (props: ImportModalProps) => {
    const actions = [
        {label: lf("Cancel"), onClick: props.onCancelClick},
        {label: lf("Remove"), className: "red", onClick: () => {props.onDeleteClick(props.ns)}}
    ]
    return <Modal title={lf("Removing extension")} actions={actions} onClose={props.onCancelClick}>
        {lf("Are you sure you want to remove this extension? Doing so will remove any of its blocks that you used in your code and other extensions that use it.")}
    </Modal>
}
