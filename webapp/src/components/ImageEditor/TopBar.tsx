import * as React from "react";

import { IconButton } from "./Button";
import { CursorSizes } from "./CursorSizes";
import { Toggle } from "./Toggle";
import { changeInterval, changeOverlayEnabled, changePreviewAnimating, imageEdit, ImageEditorContext, TilemapState, AnimationState } from "./state";
import { flipEdit, getEditState, rotateEdit } from "./toolDefinitions";


export interface TopBarProps {
    singleFrame?: boolean;
}

export const TopBar = (props: TopBarProps) => {
    const { state, dispatch } = React.useContext(ImageEditorContext);
    const [intervalInputValue, setIntervalInputValue] = React.useState<string>(null);

    const { isTilemap, previewAnimating, drawingMode } = state.editor;
    const assetState = state.store.present;

    const { interval } = assetState as AnimationState;
    const { singleFrame } = props;

    const isAnimation = !isTilemap && (assetState as AnimationState).frames.length > 1;

    const createEditState = React.useCallback(() => {
        if (isTilemap) {
            return getEditState((assetState as TilemapState).tilemap, isTilemap, drawingMode);
        }
        return getEditState((assetState as AnimationState).frames[(assetState as AnimationState).currentFrame], isTilemap);
    }, [assetState, isTilemap, drawingMode]);

    const onFlipVerticalClick = React.useCallback(() => {
        const editState = createEditState();
        const flipped = flipEdit(editState, true, isTilemap);
        dispatch(imageEdit(flipped.toImageState()));
    }, [dispatch, createEditState, isTilemap]);

    const onFlipHorizontalClick = React.useCallback(() => {
        const editState = createEditState();
        const flipped = flipEdit(editState, false, isTilemap);
        dispatch(imageEdit(flipped.toImageState()));
    }, [dispatch, createEditState, isTilemap]);

    const onRotateClockwiseClick = React.useCallback(() => {
        const editState = createEditState();
        const rotated = rotateEdit(editState, true, isTilemap, isAnimation);
        dispatch(imageEdit(rotated.toImageState()));
    }, [dispatch, createEditState, isTilemap, isAnimation]);

    const onRotateCounterClockwiseClick = React.useCallback(() => {
        const editState = createEditState();
        const rotated = rotateEdit(editState, false, isTilemap, isAnimation);
        dispatch(imageEdit(rotated.toImageState()));
    }, [dispatch, createEditState, isTilemap, isAnimation]);

    const onTogglePreviewAnimatingClick = React.useCallback(() => {
        dispatch(changePreviewAnimating(!previewAnimating));
    }, [dispatch, previewAnimating]);

    const onShowWallsClick = React.useCallback((value: boolean) => {
        dispatch(changeOverlayEnabled(value));
    }, [dispatch]);

    const onIntervalChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setIntervalInputValue(event.target.value);
    }, []);

    const onIntervalBlur = React.useCallback(() => {
        const interval = parseInt(intervalInputValue);

        if (!isNaN(interval)) {
            dispatch(changeInterval(Math.min(Math.max(interval, 50), 1000000)));
        }

        setIntervalInputValue(null);
    }, [dispatch, intervalInputValue]);

    return (
        <div className="image-editor-topbar">
            <div className="cursor-group">
                <CursorSizes />
            </div>
            <div className="image-editor-seperator"/>
            <div className="image-transform-group">
                <IconButton key="flipv" iconClass="xicon flipvertical" title={lf("Flip vertical")} onClick={onFlipVerticalClick} />
                <IconButton key="fliph" iconClass="xicon fliphorizontal" title={lf("Flip horizontal")} onClick={onFlipHorizontalClick} />
                <IconButton key="rotatec" iconClass="xicon rotateright" title={lf("Rotate clockwise")} onClick={onRotateClockwiseClick} />
                <IconButton key="rotatecc" iconClass="xicon rotateleft" title={lf("Rotate counterclockwise")} onClick={onRotateCounterClockwiseClick} />
            </div>
            <div className="spacer"/>
            { !singleFrame && <div className="image-editor-seperator"/> }
            { !singleFrame &&
                <div className="timeline-controls">
                    <IconButton
                        onClick={onTogglePreviewAnimatingClick}
                        iconClass={previewAnimating ? "ms-Icon ms-Icon--Stop" : "ms-Icon ms-Icon--Play"}
                        title={previewAnimating ? lf("Stop Animation Preview") : lf("Play Animation Preview")}
                        toggle={true}
                    />
                    <div className="image-editor-interval-label image-editor-label">
                        <span className="ms-Icon ms-Icon--Clock" />
                    </div>
                    <div className="image-editor-interval">
                        <input className="image-editor-input"
                            title={lf("Interval Between Frames (ms)")}
                            value={intervalInputValue || interval}
                            onChange={onIntervalChange}
                            onBlur={onIntervalBlur}
                        />
                    </div>
                </div>
            }
            { isTilemap &&
                <Toggle initialValue={true} label={lf("Show walls")} onChange={onShowWallsClick} />
            }
        </div>
    );
}
