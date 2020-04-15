import { ImageEditorTool } from './store/imageReducer';
import { dispatchChangeZoom, dispatchUndoImageEdit, dispatchRedoImageEdit, dispatchChangeImageTool, dispatchSwapBackgroundForeground, dispatchChangeSelectedColor} from './actions/dispatch';
import store from './store/imageStore';

export function addKeyListener() {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleUndoRedo, true);
    document.addEventListener("keydown", overrideBlocklyShortcuts, true);
}

export function removeKeyListener() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keydown", handleUndoRedo, true);
    document.removeEventListener("keydown", overrideBlocklyShortcuts, true);
}

function handleUndoRedo(event: KeyboardEvent) {
    const controlOrMeta = event.ctrlKey || event.metaKey; // ctrl on windows, meta on mac
    if (event.key === "Undo" || (controlOrMeta && event.key === "z")) {
        undo();
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === "Redo" || (controlOrMeta && event.key === "y")) {
        redo();
        event.preventDefault();
        event.stopPropagation();
    }
}

function overrideBlocklyShortcuts(event: KeyboardEvent) {
    if (event.key === "Backspace" || event.key === "Delete") {
        event.stopPropagation();
    }
}

function handleKeyDown(event: KeyboardEvent) {
    // Mostly copied from the photoshop shortcuts
    switch (event.key) {
        case "e":
            setTool(ImageEditorTool.Erase);
            break;
        case "h":
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