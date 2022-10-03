import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";

export interface EditControlsProps {
    onUndoClick: () => void;
    onRedoClick: () => void;
    hasUndo: boolean;
    hasRedo: boolean;
}

export const EditControls = (props: EditControlsProps) => {
    const { onUndoClick, onRedoClick, hasUndo, hasRedo } = props;

    return <div>

    </div>
}