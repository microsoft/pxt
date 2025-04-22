import { classList } from "react-common/components/util";
import { Strings } from "../constants";
import { NoticeLabel } from "./NoticeLabel";
import { useRef, useState } from "react";
import css from "./styling/DragAndDropFileSurface.module.scss";
import { Button } from "react-common/components/controls/Button";

export interface DragAndDropFileSurfaceProps {
    onFileDroppedAsync: (file: File) => void;
    errorMessage?: string;
}
export const DragAndDropFileSurface: React.FC<DragAndDropFileSurfaceProps> = ({ onFileDroppedAsync, errorMessage }) => {
    const [fileIsOverSurface, setFileIsOverSurface] = useState(false);
    const [errorKey, setErrorKey] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
        // Stop the browser from intercepting the file.
        event.stopPropagation();
        event.preventDefault();
    }

    function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
        event.stopPropagation();
        event.preventDefault();
        setFileIsOverSurface(true);
    }

    function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
        event.stopPropagation();
        event.preventDefault();
        setFileIsOverSurface(false);
    }

    function handleDrop(event: React.DragEvent<HTMLDivElement>) {
        event.stopPropagation();
        event.preventDefault();

        setFileIsOverSurface(false);

        const file = event.dataTransfer.files[0];
        if (file) {
            processNewFile(file);
        }
    }

    function handleFileFromBrowse(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (file) {
            processNewFile(file);
        }
    }

    function processNewFile(file: File) {
        // Change errorKey so that the error component resets (notably, resetting animations).
        setErrorKey(errorKey + 1);
        onFileDroppedAsync(file);
    }

    /*
    We can't use the drag-and-drop-file-surface directly to handle most drop events, because the child elements interfere with them.
    To solve this, we add a transparent div (droppable-surface) over everything and use that for most drag-related event handling.
    However, we don't want the transparent droppable-surface to intercept pointer events when there is no drag occurring, so
    we still use the drag-and-drop-file-surface to detect dragEnter events and only intercept pointer events on the droppable-surface
    after that has happened.
    */
    return (
        <div className={css["drag-and-drop-file-surface"]} onDragEnter={handleDragEnter}>
            <div className={css["instruction-container"]}>
                <i className={classList("fas fa-file-upload", css["upload-icon"])}></i>
                <div className="no-select">{fileIsOverSurface ? Strings.ReleaseToUpload : Strings.DragAndDrop}</div>
                <div className={css["or-browse-container"]}>
                    <span className={css["or-container"]}>{lf("or")}</span>

                    {/* The button triggers a hidden file input to open the file browser */}
                    <Button
                        className={classList("link-button", css["browse-button"])}
                        title={Strings.Browse}
                        onClick={() => fileInputRef?.current?.click()}
                    >
                        {Strings.Browse}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileFromBrowse}
                        aria-label={Strings.SelectChecklistFile}
                        accept=".json"
                    />
                </div>
            </div>

            {errorMessage && (
                <div className={css["error-label-container"]} key={errorKey} role="alert" title={errorMessage}>
                    <NoticeLabel severity="error">{errorMessage}</NoticeLabel>
                </div>
            )}

            <div
                className={classList(css["droppable-surface"], fileIsOverSurface ? css["dragging"] : undefined)}
                onDrop={handleDrop}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
            />
        </div>
    );
};
