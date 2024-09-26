import * as React from "react";

import { IconButton } from "./Button";
import { fireClickOnlyOnEnter } from "./util";
import { isNameTaken } from "../../assets";
import { obtainShortcutLock, releaseShortcutLock } from "./keyboardShortcuts";
import { classList } from "../../../../react-common/components/util";
import { changeAssetName, changeCanvasZoom, changeImageDimensions, ImageEditorContext, redoImageEdit, toggleAspectRatio, toggleOnionSkinEnabled, undoImageEdit, AnimationState, TilemapState } from "./state";


export interface BottomBarProps {
    hideAssetName?: boolean;
    singleFrame?: boolean;
    hideDoneButton?: boolean;
    onDoneClick?: () => void;
}

export const BottomBar = (props: BottomBarProps) => {
    const { state, dispatch } = React.useContext(ImageEditorContext);

    const shortcutLock = React.useRef<number>(0);
    const [widthInputValue, setWidthInputValue] = React.useState<string>();
    const [heightInputValue, setHeightInputValue] = React.useState<string>();
    const [assetNameInputValue, setAssetNameInputValue] = React.useState<string>();
    const [assetNameErrorMessage, setAssetNameErrorMessage] = React.useState<string>();

    const { hideAssetName, singleFrame, hideDoneButton, onDoneClick } = props;
    const { resizeDisabled, cursorLocation, isTilemap, onionSkinEnabled } = state.editor;

    const editState = state.store.present;
    const { aspectRatioLocked } = editState;

    const bitmap = isTilemap ?
        (editState as TilemapState).tilemap.bitmap :
        (editState as AnimationState).frames[(editState as AnimationState).currentFrame].bitmap;

    const bitmapWidth = bitmap.width;
    const bitmapHeight = bitmap.height;

    const hasUndo = !!(state.store.past.length);
    const hasRedo = !!(state.store.future.length);

    const assetName = editState.asset?.meta.displayName;

    const setShortcutsEnabled = React.useCallback((enabled: boolean) => {
        if (enabled && shortcutLock.current) {
            releaseShortcutLock(shortcutLock.current);
            shortcutLock.current = undefined;
        }
        else if (!enabled && !shortcutLock.current) {
            shortcutLock.current = obtainShortcutLock();
        }
    }, []);

    const disableShortcutsOnFocus = React.useCallback(() => {
        setShortcutsEnabled(false);
    }, [setShortcutsEnabled]);

    const handleWidthChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        const value = parseInt(text);

        if (!isNaN(value) && aspectRatioLocked) {
            setWidthInputValue(value + "");
            setHeightInputValue(Math.floor(value * (bitmapHeight / bitmapWidth)) + "");
        }
        else {
            setWidthInputValue(text);
        }
    }, [bitmapWidth, bitmapHeight, aspectRatioLocked]);

    const handleHeightChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        const value = parseInt(text);

        if (!isNaN(value) && aspectRatioLocked) {
            setHeightInputValue(value + "");
            setWidthInputValue(Math.floor(value * (bitmapWidth / bitmapHeight)) + "");
        }
        else {
            setHeightInputValue(text);
        }
    }, [bitmapWidth, bitmapHeight, aspectRatioLocked]);

    const handleDimensionalBlur = React.useCallback(() => {
        const widthVal = parseInt(widthInputValue);
        const heightVal = parseInt(heightInputValue);

        // tilemaps store in location as 1 byte, so max is 255x255
        const maxSize = isTilemap ? 255 : 512;

        const width = isNaN(widthVal) ? bitmapWidth: Math.min(Math.max(widthVal, 1), maxSize);
        const height = isNaN(heightVal) ? bitmapHeight : Math.min(Math.max(heightVal, 1), maxSize);

        if (width !== bitmapWidth || height !== bitmapHeight) {
            dispatch(changeImageDimensions(width, height));
        }

        setWidthInputValue(null);
        setHeightInputValue(null);

        setShortcutsEnabled(true);
    }, [bitmapWidth, bitmapHeight, widthInputValue, heightInputValue, dispatch, setShortcutsEnabled]);

    const handleDimensionalKeydown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        const charCode = (typeof event.which == "number") ? event.which : event.keyCode
        if (charCode === 13) {
            event.currentTarget.blur();
        }
    }, []);

    const handleAssetNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        let errorMessage = null;

        const name = event.target.value || "";      // don't trim the state otherwise they won't be able to type spaces
        const trimmedName = name.trim();            // validate using the trimmed name

        if (!pxt.validateAssetName(trimmedName)) {
            errorMessage = lf("Names may only contain letters, numbers, '-', '_', and space");
        }
        else if (isNameTaken(trimmedName) && trimmedName !== assetName) {
            errorMessage = lf("This name is already used elsewhere in your project");
        }

        setAssetNameInputValue(name);
        setAssetNameErrorMessage(errorMessage);
    }, [assetName]);

    const handleAssetNameBlur = React.useCallback(() => {
        if (assetNameInputValue) {
            let newName = assetNameInputValue.trim();

            if (newName !== assetName && pxt.validateAssetName(newName) && !isNameTaken(newName)) {
                dispatch(changeAssetName(newName))
            }
        }
        setAssetNameInputValue(null);
        setAssetNameErrorMessage(null);
        setShortcutsEnabled(true);
    }, [assetName, dispatch, setShortcutsEnabled]);

    const onToggleAspectRatioLockedClick = React.useCallback(() => {
        dispatch(toggleAspectRatio());
    }, [dispatch]);

    const onToggleOnionSkinEnabledClick = React.useCallback(() => {
        dispatch(toggleOnionSkinEnabled());
    }, [dispatch]);

    const onUndoClick = React.useCallback(() => {
        dispatch(undoImageEdit());
    }, [dispatch]);

    const onRedoClick = React.useCallback(() => {
        dispatch(redoImageEdit());
    }, [dispatch]);

    const onZoomInClick = React.useCallback(() => {
        dispatch(changeCanvasZoom(1))
    }, [dispatch]);

    const onZoomOutClick = React.useCallback(() => {
        dispatch(changeCanvasZoom(-1))
    }, [dispatch]);

    return (
        <div className="image-editor-bottombar">
            {!resizeDisabled &&
                <div className="image-editor-resize">
                    <input className="image-editor-input"
                        title={lf("Image Width")}
                        value={widthInputValue || bitmapWidth}
                        tabIndex={0}
                        onChange={handleWidthChange}
                        onFocus={disableShortcutsOnFocus}
                        onBlur={handleDimensionalBlur}
                        onKeyDown={handleDimensionalKeydown}
                    />

                    <IconButton
                        onClick={onToggleAspectRatioLockedClick}
                        iconClass={aspectRatioLocked ? "ms-Icon ms-Icon--Lock" : "ms-Icon ms-Icon--Unlock"}
                        title={aspectRatioLocked ? lf("Unlock Aspect Ratio") : lf("Lock Aspect Ratio")}
                        toggle={!aspectRatioLocked}
                        noTab
                    />

                    <input className="image-editor-input"
                        title={lf("Image Height")}
                        value={heightInputValue || bitmapHeight}
                        tabIndex={0}
                        onChange={handleHeightChange}
                        onFocus={disableShortcutsOnFocus}
                        onBlur={handleDimensionalBlur}
                        onKeyDown={handleDimensionalKeydown}
                    />
                </div>
            }
            {!singleFrame &&
                <div className="image-editor-seperator"/>
            }
            {!singleFrame &&
                <div>
                    <IconButton
                        onClick={onToggleOnionSkinEnabledClick}
                        iconClass="ms-Icon ms-Icon--MapLayers"
                        title={onionSkinEnabled ? lf("Hide Previous Frame") : lf("Show Previous Frame")}
                        toggle={!onionSkinEnabled}
                    />
                </div>
            }
            {!resizeDisabled &&
                <div className={classList("image-editor-seperator", !cursorLocation && "transparent")}/>
            }
            <div className="image-editor-coordinate-preview">
                {cursorLocation && `${cursorLocation[0]}, ${cursorLocation[1]}`}
            </div>
            <div className="image-editor-change-name">
                {!hideAssetName &&
                    <>
                        <input className="image-editor-input"
                            title={lf("Asset Name")}
                            value={assetNameInputValue || assetName || ""}
                            placeholder={lf("Asset Name")}
                            tabIndex={0}
                            onChange={handleAssetNameChange}
                            onFocus={disableShortcutsOnFocus}
                            onBlur={handleAssetNameBlur}
                            onKeyDown={handleDimensionalKeydown}
                        />
                        {assetNameErrorMessage &&
                            <div className="ui pointing below red basic label">
                                {assetNameErrorMessage}
                            </div>
                        }
                    </>
                }
            </div>
            <div className="image-editor-undo-redo">
                <IconButton
                    title={lf("Undo")}
                    iconClass="ms-Icon ms-Icon--Undo"
                    onClick={hasUndo ? onUndoClick : null}
                    disabled={!hasUndo}
                />
                <IconButton
                    title={lf("Redo")}
                    iconClass="ms-Icon ms-Icon--Redo"
                    onClick={hasRedo ? onRedoClick : null}
                    disabled={!hasRedo}
                />
            </div>
            <div className="image-editor-seperator"/>
            <div className="image-editor-zoom-controls">
                <IconButton
                    onClick={onZoomInClick}
                    iconClass="ms-Icon ms-Icon--ZoomOut"
                    title={lf("Zoom Out")}
                    toggle={true}
                />
                <IconButton
                    onClick={onZoomOutClick}
                    iconClass="ms-Icon ms-Icon--ZoomIn"
                    title={lf("Zoom In")}
                    toggle={true}
                />
            </div>
            {!hideDoneButton &&
                <div role="button"
                    className={`image-editor-confirm`}
                    title={lf("Done")}
                    tabIndex={0}
                    onClick={onDoneClick}
                    onKeyDown={fireClickOnlyOnEnter}>
                        {lf("Done")}
                </div>
            }
        </div>
    );
}
