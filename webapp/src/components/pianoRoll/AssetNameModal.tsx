import { Input } from "../../../../react-common/components/controls/Input";
import { Modal, ModalAction } from "../../../../react-common/components/controls/Modal";
import { useState } from "react";
import { isNameTaken } from "../../assets";

interface AssetNameModalProps {
    assetName: string;
    onAssetNameChanged: (newAssetName: string) => void;
    onClose: () => void;
}

export const AssetNameModal = (props: AssetNameModalProps) => {
    const {
        assetName,
        onAssetNameChanged,
        onClose
    } = props;

    const [editName, setEditName] = useState(assetName);
    const [nameError, setNameError] = useState<string>();

    const handleNameEdit = (newValue: string) => {
        let errorMessage = null;

        const trimmedName = newValue.trim(); // validate using the trimmed name

        if (!trimmedName) {
            setEditName("");
            setNameError(undefined);
            return;
        }

        if (!pxt.validateAssetName(trimmedName)) {
            errorMessage = lf("Names may only contain letters, numbers, '-', '_', and space");
        }
        else if (isNameTaken(trimmedName) && trimmedName !== assetName) {
            errorMessage = lf("This name is already used elsewhere in your project");
        }

        if (errorMessage) {
            setNameError(errorMessage);
        }
        else {
            setNameError(undefined);
        }
        setEditName(trimmedName);
    }

    const onSaveClick = () => {
        if (!nameError) {
            onAssetNameChanged(editName);
            onClose();
        }
    }

    const actions: ModalAction[] = [
        {
            label: lf("Cancel"),
            onClick: onClose
        },
        {
            label: lf("Save"),
            onClick: onSaveClick,
            disabled: !!nameError
        }
    ];

    return (
        <Modal
            className="piano-roll-asset-name-modal"
            title={lf("Change Asset Name")}
            onClose={onClose}
            actions={actions}
        >
            <div className="piano-roll-asset-name-modal-content">
                <label htmlFor="asset-name-input">{lf("Asset Name")}</label>
                <Input
                    id="asset-name-input"
                    initialValue={editName}
                    onBlur={handleNameEdit}
                    onEnterKey={handleNameEdit}
                    onChange={handleNameEdit}
                />
                {nameError &&
                    <div className="piano-roll-asset-name-error">
                        {nameError}
                    </div>
                }
            </div>
        </Modal>
    )
}