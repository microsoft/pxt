import * as React from "react";
import { Modal } from "../controls/Modal"

export interface ImportModalProps {
    onCancelClick: () => void,
    onImportClick: (url: string) => void
}

export const ImportModal = (props: ImportModalProps) => {

    const handleOnImportClick = () => {
        props.onImportClick((document.getElementById("url-input") as HTMLFormElement).value)
    }

    const actions = [
        {
            label: lf("Cancel"),
            onClick: props.onCancelClick
        },
        {
            label: lf("Import"),
            onClick: handleOnImportClick
        }
    ];
    return <Modal title={lf("Import extension")} actions={actions} className="import-extension-modal">
        {lf("Enter Github project URL")}
        <input id="url-input"></input>
    </Modal>
}