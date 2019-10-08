import { ImageEditorTool } from './store/imageReducer';
import { dispatchChangeZoom, dispatchUndoImageEdit, dispatchRedoImageEdit, dispatchChangeImageTool, dispatchSwapBackgroundForeground } from './actions/dispatch';
import store from './store/imageStore';

export function addKeyListener() {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleUndoRedo, true);
}

export function removeKeyListener() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keydown", handleUndoRedo, true);
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

function zoom(delta: number) {
    dispatchAction(dispatchChangeZoom(delta));
}

function swapForegroundBackground() {
    dispatchAction(dispatchSwapBackgroundForeground());
}

function dispatchAction(action: any) {
    store.dispatch(action);
}