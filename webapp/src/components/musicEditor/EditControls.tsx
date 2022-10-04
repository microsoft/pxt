import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { Input } from "../../../../react-common/components/controls/Input";
import { isNameTaken } from "../../assets";

export interface EditControlsProps {
    hasUndo: boolean;
    hasRedo: boolean;
    hideTracksActive: boolean;
    assetName: string;
    onUndoClick: () => void;
    onRedoClick: () => void;
    onHideTracksClick: () => void;
    onAssetNameChanged: (newName: string) => void;
    onDoneClicked: () => void;
}

export const EditControls = (props: EditControlsProps) => {
    const { onUndoClick, onRedoClick, onHideTracksClick, onAssetNameChanged, onDoneClicked, hasUndo, hasRedo, hideTracksActive, assetName } = props;
    const [editName, setEditName] = React.useState<string>();
    const [nameError, setNameError] = React.useState<string>();

    const handleNameEdit = (newValue: string) => {
        let errorMessage = null;

        const trimmedName = newValue.trim(); // validate using the trimmed name

        if (!trimmedName) {
            setEditName(undefined);
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
            setEditName(trimmedName);
            setNameError(errorMessage);
        }
        else {
            onAssetNameChanged(trimmedName);
            setEditName(undefined);
            setNameError(undefined);
        }
    }

    return <div className="music-editor-edit-controls">
        {nameError &&
            <div className="music-editor-name-error">
                {nameError}
            </div>
        }
        <Input
            placeholder={lf("Asset Name")}
            initialValue={assetName || editName}
            onBlur={handleNameEdit}
            onEnterKey={handleNameEdit} />
        <Button
            className="menu-button"
            title={lf("Undo")}
            leftIcon="xicon undo"
            disabled={!hasUndo}
            onClick={onUndoClick} />
        <Button
            className="menu-button"
            title={lf("Redo")}
            leftIcon="xicon redo"
            disabled={!hasRedo}
            onClick={onRedoClick} />
        <Button
            className="menu-button"
            title={hideTracksActive ? lf("Show all tracks") : lf("Hide unselected tracks")}
            leftIcon={hideTracksActive ? "fas fa-eye-slash" : "fas fa-eye"}
            onClick={onHideTracksClick} />
        <Button
            className="green"
            title={lf("Done")}
            label={lf("Done")}
            onClick={onDoneClicked} />
    </div>
}