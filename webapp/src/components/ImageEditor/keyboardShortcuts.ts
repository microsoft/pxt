
import { EditState, flipEdit, getEditState, outlineEdit, replaceColorEdit, rotateEdit } from './toolDefinitions';
import { ImageEditorContext, ImageEditorTool, ImageEditorStore, TilemapState, AnimationState, CursorSize, undoImageEdit, redoImageEdit, changeImageTool, changeSelectedColor, changeCanvasZoom, swapForegroundBackground, changeCursorSize, imageEdit } from './state';
import { useContext, useEffect } from 'react';

let lockRefs: number[] = [];

export function useKeyboardShortcuts() {
    const { state, dispatch } = useContext(ImageEditorContext);

    const animationState = state.store.present as AnimationState;
    const tilemapState = state.store.present as TilemapState;

    const { selectedColor, backgroundColor, isTilemap, drawingMode, cursorSize } = state.editor

    useEffect(() => {
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
                    swapForegroundBackgroundColors();
                    break;
                case "H":
                    flip(false);
                    break;
                case "V":
                    flip(true);
                    break;
                case "[":
                    rotate(false);
                    break;
                case "]":
                    rotate(true);
                    break;
                case ">":
                    changeCursor(true);
                    break;
                case "<":
                    changeCursor(false);
                    break;

            }

            if (event.shiftKey && event.code === "KeyR") {
                replaceColor(backgroundColor, selectedColor);
                return;
            }

            if (!isTilemap && /^Digit\d$/.test(event.code)) {
                const keyAsNum = +event.code.slice(-1);
                const color = keyAsNum + (event.shiftKey ? 9 : 0);
                // TODO: if we need to generalize for different numbers of colors,
                // will need to fix the magic 16 here
                if (color >= 0 && color < 16)
                    setColor(color);
            }
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
                event.stopPropagation();
            }
        }

        function currentEditState(): [EditState, "tilemap" | "animation" | "image"] {
            if (isTilemap) {
                return [getEditState(tilemapState.tilemap, true, drawingMode), "tilemap"]
            }
            else {
                return [getEditState(animationState.frames[animationState.currentFrame], false, drawingMode), animationState.frames.length > 1 ? "animation" : "image" ]
            }
        }

        function undo() {
            dispatch(undoImageEdit());
        }

        function redo() {
            dispatch(redoImageEdit());
        }

        function setTool(tool: ImageEditorTool) {
            dispatch(changeImageTool(tool));
        }

        function setColor(selectedColor: number) {
            dispatch(changeSelectedColor(selectedColor));
        }

        function zoom(delta: number) {
            dispatch(changeCanvasZoom(delta));
        }

        function swapForegroundBackgroundColors() {
            dispatch(swapForegroundBackground());
        }

        function changeCursor(larger: boolean) {
            let nextSize: CursorSize;
            const currentSize = cursorSize;

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
                dispatch(changeCursorSize(nextSize));
            }
        }

        function flip(vertical: boolean) {
            const [ editState, type ] = currentEditState();
            const flipped = flipEdit(editState, vertical, type === "tilemap");
            dispatch(imageEdit(flipped.toImageState()));
        }

        function rotate(clockwise: boolean) {
            const [ editState, type ] = currentEditState();
            const rotated = rotateEdit(editState, clockwise, type === "tilemap", type === "animation");
            dispatch(imageEdit(rotated.toImageState()));
        }

        function outline(color: number) {
            const [ editState, type ] = currentEditState();

            if (type === "tilemap") return;

            const outlined = outlineEdit(editState, color);
            dispatch(imageEdit(outlined.toImageState()));
        }

        function replaceColor(fromColor: number, toColor: number) {
            const [ editState, type ] = currentEditState();
            const replaced = replaceColorEdit(editState, fromColor, toColor);
            dispatch(imageEdit(replaced.toImageState()));
        }

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keydown", handleUndoRedo, true);
        document.addEventListener("keydown", overrideBlocklyShortcuts, true);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keydown", handleUndoRedo, true);
            document.removeEventListener("keydown", overrideBlocklyShortcuts, true);
        }
    }, [selectedColor, backgroundColor, isTilemap, drawingMode, cursorSize, animationState, tilemapState]);
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
