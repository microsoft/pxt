import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { BasicEditorToggleItem, EditorToggle } from "../../../../react-common/components/controls/EditorToggle";

export interface SoundEffectHeaderProps {
    selectedView: "editor" | "gallery";
    onClose: () => void;
    onViewSelected: (view: "editor" | "gallery") => void;
}

export const SoundEffectHeader = (props: SoundEffectHeaderProps) => {
    const { selectedView, onClose, onViewSelected } = props;
    const toggleItems: BasicEditorToggleItem[] = [
        {
            label: pxt.U.lf("Editor"),
            title: pxt.U.lf("Editor"),
            onClick: () => onViewSelected("editor"),
            focusable: true
        },
        {
            label: pxt.U.lf("Gallery"),
            title: pxt.U.lf("Gallery"),
            onClick: () => onViewSelected("gallery"),
            focusable: true
        }
    ]
    return <div className="sound-effect-header">
            <EditorToggle
                id="sound-effect-editor-toggle"
                items={toggleItems}
                selected={selectedView === "editor" ? 0 : 1}
            />

        <Button
            className="menu-button"
            onClick={onClose}
            title={lf("Close")}
            rightIcon="fas fa-times-circle"
        />

    </div>
}