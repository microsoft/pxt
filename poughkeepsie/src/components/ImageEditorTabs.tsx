import React, { useCallback, useContext } from "react";
import { renderIcon } from "../utils/icons";
import { AppStateContext } from "../state/appStateContext";

import css from "./styling/ImageEditorTabs.module.scss";
import { switchImageTab } from "../transforms/switchImageTab";

export const ImageEditorTabs: React.FC = () => {
    const types = [
        "avatar",
        "tile",
        "sprite",
        "item"
    ];

    return (
        <div className={css["image-editor-tabs"]}>
            {types.map(type =>
                <ImageEditorTab
                    key={type}
                    type={type}
                />
            )}
        </div>
    );
}

interface EditorTabProps {
    type: string;
}

const ImageEditorTab: React.FC<EditorTabProps> = ({ type }) => {
    const { state } = useContext(AppStateContext);

    const onClick = useCallback(() => {
        switchImageTab(type);
    }, [type]);

    return (
        <div className={css["image-editor-tab"]} onClick={onClick}>
            <img src={renderIcon(type, type === state.activeImageTab)} />
        </div>
    )
}