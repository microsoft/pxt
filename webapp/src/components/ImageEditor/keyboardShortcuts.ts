
import { Store } from 'redux';
import { ImageEditorTool, ImageEditorStore, TilemapState, AnimationState, CursorSize } from './store/imageReducer';
import { dispatchChangeZoom, dispatchUndoImageEdit, dispatchRedoImageEdit, dispatchChangeImageTool, dispatchSwapBackgroundForeground, dispatchChangeSelectedColor, dispatchImageEdit, dispatchChangeCursorSize, dispatchChangeCurrentFrame, dispatchSetFrames} from './actions/dispatch';
import { mainStore } from './store/imageStore';
import { EditState, flipEdit, getEditState, outlineEdit, replaceColorEdit, rotateEdit } from './toolDefinitions';
let store = mainStore;

let lockRefs: number[] = [];

export function addKeyListener() {
    lockRefs = [];
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleUndoRedo, true);
    document.addEventListener("keydown", overrideBlocklyShortcuts, true);
}

export function removeKeyListener() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keydown", handleUndoRedo, true);
    document.removeEventListener("keydown", overrideBlocklyShortcuts, true);
}

// Disables shortcuts and returns a ref. Enable by passing the ref to release shortcut lock
export function obtainShortcutLock(): number {
    let ref = 0;
    while (!ref) ref = Math.random() * Number.MAX_SAFE_INTEGER
    lockRefs.push(ref);
    return ref;
}

// Enables shortcuts using the ref obtained from obtainShortcutLock
export function releaseShortcutLock(ref: number) {
    const index = lockRefs.indexOf(ref)
    if (index !== -1) {
        lockRefs.splice(index, 1);
    }
}

export function areShortcutsEnabled() {
    return !lockRefs.length;
}

export function setStore(newStore?: Store<ImageEditorStore>) {
    store = newStore || mainStore;
}

function handleUndoRedo(event: KeyboardEvent) {
    const controlOrMeta = event.ctrlKey || event.metaKey; // ctrl on windows, meta on mac
    if (event.key === "Undo" || (controlOrMeta && event.key === "z" && !event.shiftKey)) {
        undo();
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === "Redo" || (controlOrMeta && event.key === "y") || (controlOrMeta && event.key === "Z" && event.shiftKey)) {
        redo();
        event.preventDefault();
        event.stopPropagation();
    }
}

function overrideBlocklyShortcuts(event: KeyboardEvent) {
    if (event.key === "Backspace" || event.key === "Delete") {
        handleKeyDown(event);
        event.stopPropagation();
    }
}

function handleKeyDown(event: KeyboardEvent) {
    if (!areShortcutsEnabled()) return;

    if (event.shiftKey && /^(?:Digit[1-9])|(?:Key[A-F])$/.test(event.code)) {
        if (event.code.indexOf("Digit") == 0) outline(parseInt(event.code.substring(5)))
        else outline(parseInt(event.code.substring(3), 16));
        return;
    }

    // Mostly copied from the photoshop shortcuts
    switch (event.key) {
        case "e":
            setTool(ImageEditorTool.Erase);
            break;
        case "q":
            setTool(ImageEditorTool.Pan);
            break;
        case "b":
        case "p":
            setTool(ImageEditorTool.Paint);
            break;
        case "g":
            setTool(ImageEditorTool.Fill);
            break;
        case "m":
            setTool(ImageEditorTool.Marquee);
            break;
        case "u":
            setTool(ImageEditorTool.Rect);
            break;
        case "l":
            setTool(ImageEditorTool.Line);
            break;
        case "c":
            setTool(ImageEditorTool.Circle);
            break;
        case "-":
        case "_":
            zoom(-1);
            break;
        case "=":
        case "+":
            zoom(1);
            break;
        case "x":
            swapForegroundBackground();
            break;
        case "h":
            flip(false);
            break;
        case "v":
            flip(true);
            break;
        case "H":
            flipAllFrames(false);
            break;
        case "V":
            flipAllFrames(true);
            break;
        case "[":
            rotate(false);
            break;
        case "]":
            rotate(true);
            break;
        case "{":
            rotateAllFrames(false);
            break;
        case "}":
            rotateAllFrames(true);
            break;
        case ">":
            changeCursorSize(true);
            break;
        case "<":
            changeCursorSize(false);
            break;
        case ".":
            advanceFrame(true);
            break;
        case ",":
            advanceFrame(false);
            break;
        case "PageDown":
            moveFrame(true, event.shiftKey);
            break;
        case "PageUp":
            moveFrame(false, event.shiftKey);
            break;
        case "r":
            doColorReplace();
            break;
        case "R":
            doColorReplaceAllFrames();
            break;
        case "ArrowLeft":
            moveMarqueeSelection(-1, 0, event.shiftKey);
            break;
        case "ArrowRight":
            moveMarqueeSelection(1, 0, event.shiftKey);
            break;
        case "ArrowUp":
            moveMarqueeSelection(0, -1, event.shiftKey);
            break;
        case "ArrowDown":
            moveMarqueeSelection(0, 1, event.shiftKey);
            break;
        case "Backspace":
        case "Delete":
            deleteSelection(event.shiftKey);
            break;
    }

    const editorState = store.getState().editor;

    if (!editorState.isTilemap && /^Digit\d$/.test(event.code)) {
        const keyAsNum = +event.code.slice(-1);
        const color = keyAsNum + (event.shiftKey ? 9 : 0);
        // TODO: if we need to generalize for different numbers of colors,
        // will need to fix the magic 16 here
        if (color >= 0 && color < 16)
            setColor(color);
    }
}

function currentEditState(): [EditState, "tilemap" | "animation" | "image"] {
    const state = store.getState();

    if (state.editor.isTilemap) {
        const tilemapState = state.store.present as TilemapState;
        return [getEditState(tilemapState.tilemap, true, state.editor.drawingMode), "tilemap"]
    }
    else {
        const animationState = state.store.present as AnimationState;
        return [getEditState(animationState.frames[animationState.currentFrame], false, state.editor.drawingMode), animationState.frames.length > 1 ? "animation" : "image" ]
    }
}

function undo() {
    dispatchAction(dispatchUndoImageEdit());
}

function redo() {
    dispatchAction(dispatchRedoImageEdit());
}

function setTool(tool: ImageEditorTool) {
    dispatchAction(dispatchChangeImageTool(tool));
}

function setColor(selectedColor: number) {
    dispatchAction(dispatchChangeSelectedColor(selectedColor))
}

function zoom(delta: number) {
    dispatchAction(dispatchChangeZoom(delta));
}

function swapForegroundBackground() {
    dispatchAction(dispatchSwapBackgroundForeground());
}

function dispatchAction(action: any) {
    store.dispatch(action);
}

function changeCursorSize(larger: boolean) {
    let nextSize: CursorSize;
    const currentSize = store.getState().editor.cursorSize;

    switch (currentSize) {
        case CursorSize.One:
            nextSize = larger ? CursorSize.Three : CursorSize.One;
            break;
        case CursorSize.Three:
            nextSize = larger ? CursorSize.Five : CursorSize.One;
            break;
        case CursorSize.Five:
            nextSize = larger ? CursorSize.Five : CursorSize.Three;
    }

    if (currentSize !== nextSize) {
        dispatchAction(dispatchChangeCursorSize(nextSize));
    }
}

export function flip(vertical: boolean) {
    const [ editState, type ] = currentEditState();
    const flipped = flipEdit(editState, vertical, type === "tilemap");
    dispatchAction(dispatchImageEdit(flipped.toImageState()));
}

export function flipAllFrames(vertical: boolean) {
    editAllFrames(() => flip(vertical), editState => flipEdit(editState, vertical, false));
}

export function rotate(clockwise: boolean) {
    const [ editState, type ] = currentEditState();
    const rotated = rotateEdit(editState, clockwise, type === "tilemap", type === "animation");
    dispatchAction(dispatchImageEdit(rotated.toImageState()));
}

export function rotateAllFrames(clockwise: boolean) {
    editAllFrames(() => rotate(clockwise), editState => rotateEdit(editState, clockwise, false, true));
}

export function outline(color: number) {
    const [ editState, type ] = currentEditState();

    if (type === "tilemap") return;

    const outlined = outlineEdit(editState, color);
    dispatchAction(dispatchImageEdit(outlined.toImageState()));
}

export function replaceColor(fromColor: number, toColor: number) {
    const [ editState, type ] = currentEditState();
    const replaced = replaceColorEdit(editState, fromColor, toColor);
    dispatchAction(dispatchImageEdit(replaced.toImageState()));
}

function doColorReplace() {
    const state = store.getState();

    const fromColor = state.editor.backgroundColor;
    const toColor = state.editor.selectedColor;

    const [ editState ] = currentEditState();
    const replaced = replaceColorEdit(editState, fromColor, toColor);
    dispatchAction(dispatchImageEdit(replaced.toImageState()));
}

function doColorReplaceAllFrames() {
    const state = store.getState();

    const fromColor = state.editor.backgroundColor;
    const toColor = state.editor.selectedColor;

    editAllFrames(doColorReplace, editState => replaceColorEdit(editState, fromColor, toColor))
}

export function advanceFrame(forwards: boolean) {
    const state = store.getState();

    if (state.editor.isTilemap) return;

    const present = state.store.present as AnimationState;

    if (present.frames.length <= 1) return;

    let nextFrame: number;
    if (forwards) {
        nextFrame = (present.currentFrame + 1) % present.frames.length;
    }
    else {
        nextFrame = (present.currentFrame + present.frames.length - 1) % present.frames.length;
    }

    dispatchAction(dispatchChangeCurrentFrame(nextFrame));
}

export function moveFrame(forwards: boolean, allFrames = false) {
    const state = store.getState();

    if (state.editor.isTilemap) return;

    const present = state.store.present as AnimationState;

    if (present.frames.length <= 1) return;

    let nextFrame: number;
    if (forwards) {
        nextFrame = (present.currentFrame + 1) % present.frames.length;
    }
    else {
        nextFrame = (present.currentFrame + present.frames.length - 1) % present.frames.length;
    }

    const newFrames = present.frames.slice();


    if (allFrames) {
        if (forwards) {
            newFrames.unshift(newFrames.pop());
        }
        else {
            newFrames.push(newFrames.shift());
        }
    }
    else {
        const currentFrame = newFrames[present.currentFrame];
        newFrames.splice(present.currentFrame, 1);
        newFrames.splice(nextFrame, 0, currentFrame);
    }

    dispatchAction(dispatchSetFrames(newFrames, nextFrame));
}

function editAllFrames(singleFrameShortcut: () => void, doEdit: (editState: EditState) => EditState) {
    const state = store.getState();

    if (state.editor.isTilemap) {
        singleFrameShortcut();
        return;
    }

    const present = state.store.present as AnimationState;

    if (present.frames.length === 1) {
        singleFrameShortcut();
        return;
    }

    const current = present.frames[present.currentFrame];

    // if the current frame has a marquee selection, apply that selection
    // to all frames
    const hasFloatingLayer = !!current.floating;
    const layerWidth = current.floating?.bitmap.width;
    const layerHeight = current.floating?.bitmap.height;
    const layerX = current.layerOffsetX;
    const layerY = current.layerOffsetY;

    const newFrames: pxt.sprite.ImageState[] = [];

    for (const frame of present.frames) {
        const editState = getEditState(frame, false);

        if (hasFloatingLayer) {
            if (editState.floating?.image) {
                // check the existing floating layer to see if it matches before
                // merging down. otherwise non-square rotations might lose
                // information if they cause the floating layer to go off the canvas
                if (editState.layerOffsetX !== layerX ||
                    editState.layerOffsetY !== layerY ||
                    editState.floating.image.width !== layerWidth ||
                    editState.floating.image.height !== layerHeight
                ) {
                    editState.mergeFloatingLayer();
                    editState.copyToLayer(layerX, layerY, layerWidth, layerHeight, true);
                }
            }
            else {
                editState.copyToLayer(layerX, layerY, layerWidth, layerHeight, true);
            }
        }
        else {
            editState.mergeFloatingLayer();
        }

        const edited = doEdit(editState);
        newFrames.push(edited.toImageState());
    }

    dispatchAction(dispatchSetFrames(newFrames, present.currentFrame));
}

function moveMarqueeSelection(dx: number, dy: number, allFrames = false) {
    const [ editState ] = currentEditState();

    if (!editState.floating?.image) return;

    const moveState = (editState: EditState) => {
        editState.layerOffsetX += dx;
        editState.layerOffsetY += dy;
        return editState;
    };


    if (!allFrames) {
        dispatchAction(dispatchImageEdit(moveState(editState).toImageState()));
    }
    else {
        editAllFrames(() => moveMarqueeSelection(dx, dy), moveState);
    }
}

function deleteSelection(allFrames = false) {
    const [ editState ] = currentEditState();

    if (!editState.floating?.image) return;

    const deleteFloatingLayer = (editState: EditState) => {
        editState.floating = null;
        return editState;
    };


    if (!allFrames) {
        dispatchAction(dispatchImageEdit(deleteFloatingLayer(editState).toImageState()));
    }
    else {
        editAllFrames(() => deleteSelection(), deleteFloatingLayer);
    }
}