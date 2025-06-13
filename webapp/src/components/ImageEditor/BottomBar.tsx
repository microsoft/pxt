import * as React from "react";

import { connect } from 'react-redux';
import { ImageEditorStore, AnimationState, TilemapState } from './store/imageReducer';
import { dispatchChangeImageDimensions, dispatchUndoImageEdit, dispatchRedoImageEdit, dispatchToggleAspectRatioLocked, dispatchChangeZoom, dispatchToggleOnionSkinEnabled, dispatchChangeAssetName } from './actions/dispatch';
import { fireClickOnlyOnEnter } from "./util";
import { isNameTaken } from "../../assets";
import { obtainShortcutLock, releaseShortcutLock } from "./keyboardShortcuts";
import { classList } from "../../../../react-common/components/util";
import { Button } from "../../../../react-common/components/controls/Button";

export interface BottomBarProps {
    dispatchChangeImageDimensions: (dimensions: [number, number]) => void;
    dispatchChangeZoom: (zoomDelta: number) => void;
    imageDimensions: [number, number];
    cursorLocation: [number, number];

    resizeDisabled: boolean;
    hasUndo: boolean;
    hasRedo: boolean;
    assetName?: string;

    aspectRatioLocked: boolean;
    onionSkinEnabled: boolean;
    hideAssetName: boolean;

    dispatchUndoImageEdit: () => void;
    dispatchRedoImageEdit: () => void;
    dispatchToggleAspectRatioLocked: () => void;
    dispatchToggleOnionSkinEnabled: () => void;
    dispatchChangeAssetName: (name: string) => void;

    singleFrame?: boolean;
    isTilemap?: boolean;

    onDoneClick?: () => void;
    hideDoneButton?: boolean;
}

export interface BottomBarState {
    width?: string;
    height?: string;
    assetNameMessage?: string;
    assetName?: string;
}

export class BottomBarImpl extends React.Component<BottomBarProps, BottomBarState> {
    protected shortcutLock: number;

    constructor(props: BottomBarProps) {
        super(props);
        this.state = {};
    }

    render() {
        const {
            imageDimensions,
            cursorLocation,
            hasUndo,
            hasRedo,
            dispatchUndoImageEdit,
            dispatchRedoImageEdit,
            aspectRatioLocked,
            onionSkinEnabled,
            dispatchToggleAspectRatioLocked,
            dispatchToggleOnionSkinEnabled,
            resizeDisabled,
            singleFrame,
            onDoneClick,
            assetName,
            hideDoneButton,
            hideAssetName
        } = this.props;

        const { assetNameMessage } = this.state;

        const width = this.state.width == null ? imageDimensions[0] : this.state.width;
        const height = this.state.height == null ? imageDimensions[1] : this.state.height;

        const assetNameState = this.state.assetName == null ? (assetName || "") : this.state.assetName;

        return (
            <div className="image-editor-bottombar">
                { !resizeDisabled &&
                    <div className="image-editor-resize">
                        <input className="image-editor-input"
                            title={lf("Image Width")}
                            value={width}
                            tabIndex={0}
                            onChange={this.handleWidthChange}
                            onFocus={this.disableShortcutsOnFocus}
                            onBlur={this.handleDimensionalBlur}
                            onKeyDown={this.handleDimensionalKeydown}
                        />

                        <Button
                            className={classList("image-editor-button", !aspectRatioLocked && "toggle")}
                            onClick={dispatchToggleAspectRatioLocked}
                            leftIcon={aspectRatioLocked ? "ms-Icon ms-Icon--Lock" : "ms-Icon ms-Icon--Unlock"}
                            title={aspectRatioLocked ? lf("Unlock Aspect Ratio") : lf("Lock Aspect Ratio")}
                        />

                        <input className="image-editor-input"
                            title={lf("Image Height")}
                            value={height}
                            tabIndex={0}
                            onChange={this.handleHeightChange}
                            onFocus={this.disableShortcutsOnFocus}
                            onBlur={this.handleDimensionalBlur}
                            onKeyDown={this.handleDimensionalKeydown}
                        />
                    </div>
                }
                { !singleFrame && <div className="image-editor-seperator"/> }
                { !singleFrame && <div>
                    <Button
                        onClick={dispatchToggleOnionSkinEnabled}
                        className={classList("image-editor-button", !onionSkinEnabled && "toggle")}
                        leftIcon="ms-Icon ms-Icon--MapLayers"
                        title={onionSkinEnabled ? lf("Hide Previous Frame") : lf("Show Previous Frame")}
                    />
                </div> }
                { !resizeDisabled && <div className={classList("image-editor-seperator", !cursorLocation && "transparent")}/> }
                <div className="image-editor-coordinate-preview">
                    {cursorLocation && `${cursorLocation[0]}, ${cursorLocation[1]}`}
                </div>
                <div className="image-editor-change-name">
                    {!hideAssetName &&
                        <>
                            <input className="image-editor-input"
                                title={lf("Asset Name")}
                                value={assetNameState}
                                placeholder={lf("Asset Name")}
                                tabIndex={0}
                                onChange={this.handleAssetNameChange}
                                onFocus={this.disableShortcutsOnFocus}
                                onBlur={this.handleAssetNameBlur}
                                onKeyDown={this.handleDimensionalKeydown}
                            />
                            {assetNameMessage && <div className="ui pointing below red basic label">
                                {assetNameMessage}
                            </div>}
                        </>
                    }
                </div>
                <div className="image-editor-undo-redo">
                    <Button
                        className="image-editor-button"
                        title={lf("Undo")}
                        leftIcon="ms-Icon ms-Icon--Undo"
                        onClick={hasUndo ? dispatchUndoImageEdit : null}
                        disabled={!hasUndo}
                    />
                    <Button
                        className="image-editor-button"
                        title={lf("Redo")}
                        leftIcon="ms-Icon ms-Icon--Redo"
                        onClick={hasRedo ? dispatchRedoImageEdit : null}
                        disabled={!hasRedo}
                    />
                </div>
                <div className="image-editor-seperator"/>
                <div className="image-editor-zoom-controls">
                    <Button
                        className="image-editor-button toggle"
                        onClick={this.zoomOut}
                        leftIcon="ms-Icon ms-Icon--ZoomOut"
                        title={lf("Zoom Out")}
                    />
                    <Button
                        className="image-editor-button toggle"
                        onClick={this.zoomIn}
                        leftIcon="ms-Icon ms-Icon--ZoomIn"
                        title={lf("Zoom In")}
                    />
                </div>
                {!hideDoneButton &&
                    <Button
                        className="image-editor-confirm"
                        title={lf("Done")}
                        label={lf("Done")}
                        onClick={onDoneClick}
                    />
                }
            </div>
        );
    }

    protected disableShortcutsOnFocus = () => {
        this.setShortcutsEnabled(false);
    }

    protected handleWidthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        const value = parseInt(text);

        const { aspectRatioLocked, imageDimensions } = this.props;

        if (!isNaN(value) && aspectRatioLocked) {
            this.setState({
                width: value + "",
                height: Math.floor(value * (imageDimensions[1] / imageDimensions[0])) + ""
            })
        }
        else {
            this.setState({ width: text });
        }
    }

    protected handleHeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const text = event.target.value;
        const value = parseInt(text);

        const { aspectRatioLocked, imageDimensions } = this.props;

        if (!isNaN(value) && aspectRatioLocked) {
            this.setState({
                height: value + "",
                width: Math.floor(value * (imageDimensions[0] / imageDimensions[1])) + ""
            })
        }
        else {
            this.setState({ height: text });
        }
    }

    protected handleDimensionalBlur = () => {
        const { imageDimensions, isTilemap, dispatchChangeImageDimensions } = this.props;

        const widthVal = parseInt(this.state.width);
        const heightVal = parseInt(this.state.height);

        // tilemaps store in location as 1 byte, so max is 255x255
        const maxSize = isTilemap ? 255 : 512;

        const width = isNaN(widthVal) ? imageDimensions[0] : Math.min(Math.max(widthVal, 1), maxSize);
        const height = isNaN(heightVal) ? imageDimensions[1] : Math.min(Math.max(heightVal, 1), maxSize);

        if (width !== imageDimensions[0] || height !== imageDimensions[1]) {
            dispatchChangeImageDimensions([width, height]);
        }

        this.setState({
            width: null,
            height: null
        });
        this.setShortcutsEnabled(true);
    }

    protected handleDimensionalKeydown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const charCode = (typeof event.which == "number") ? event.which : event.keyCode
        if (charCode === 13) {
            event.currentTarget.blur();
        }
    }

    protected handleAssetNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        let errorMessage = null;

        const name = event.target.value || "";      // don't trim the state otherwise they won't be able to type spaces
        const trimmedName = name.trim();            // validate using the trimmed name

        if (!pxt.validateAssetName(trimmedName)) {
            errorMessage = lf("Names may only contain letters, numbers, '-', '_', and space");
        }
        else if (isNameTaken(trimmedName) && trimmedName !== this.props.assetName) {
            errorMessage = lf("This name is already used elsewhere in your project");
        }

        this.setState({ assetName: name, assetNameMessage: errorMessage });
    }

    protected handleAssetNameBlur = () => {
        const { dispatchChangeAssetName, assetName } = this.props;

        if (this.state.assetName) {
            let newName = this.state.assetName.trim();

            if (newName !== assetName && pxt.validateAssetName(newName) && !isNameTaken(newName)) {
                dispatchChangeAssetName(newName);
            }
        }
        this.setState({ assetName: null, assetNameMessage: null });
        this.setShortcutsEnabled(true);
    }

    protected zoomIn = () => {
        this.props.dispatchChangeZoom(1)
    }

    protected zoomOut = () => {
        this.props.dispatchChangeZoom(-1)
    }

    protected setShortcutsEnabled(enabled: boolean) {
        if (enabled && this.shortcutLock) {
            releaseShortcutLock(this.shortcutLock);
            this.shortcutLock = undefined;
        }
        else if (!enabled && !this.shortcutLock) {
            this.shortcutLock = obtainShortcutLock();
        }
    }
}

function mapStateToProps({store: { present: state, past, future }, editor}: ImageEditorStore, ownProps: any) {
    if (!state) return {};

    const bitmap = editor.isTilemap ? (state as TilemapState).tilemap.bitmap : (state as AnimationState).frames[(state as AnimationState).currentFrame].bitmap;

    return {
        imageDimensions: [ bitmap.width, bitmap.height ],
        aspectRatioLocked: state.aspectRatioLocked,
        onionSkinEnabled: editor.onionSkinEnabled,
        cursorLocation: editor.cursorLocation,
        resizeDisabled: state.asset?.type === pxt.AssetType.Tile,
        assetName: state.asset?.meta?.displayName,
        hasUndo: !!past.length,
        hasRedo: !!future.length,
        isTilemap: editor.isTilemap,
    };
}

const mapDispatchToProps = {
    dispatchChangeImageDimensions,
    dispatchUndoImageEdit,
    dispatchRedoImageEdit,
    dispatchToggleAspectRatioLocked,
    dispatchToggleOnionSkinEnabled,
    dispatchChangeZoom,
    dispatchChangeAssetName
};


export const BottomBar = connect(mapStateToProps, mapDispatchToProps)(BottomBarImpl);
