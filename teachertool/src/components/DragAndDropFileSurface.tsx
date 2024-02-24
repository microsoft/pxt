import { classList } from "react-common/components/util";
import { Strings } from "../constants";
import { NoticeLabel } from "./NoticeLabel";
import { useState } from "react";
import css from "./styling/DragAndDropFileSurface.module.scss";

export interface DragAndDropFileSurfaceProps {
    onFileDroppedAsync: (file: File) => void;
    errorMessage?: string;
}
export const DragAndDropFileSurface: React.FC<DragAndDropFileSurfaceProps> = ({ onFileDroppedAsync, errorMessage }) => {
    const [fileIsOverSurface, setFileIsOverSurface] = useState(false);

    function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
        // Stop the browser from intercepting the file.
        event.preventDefault();
    }

    function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setFileIsOverSurface(true);
    }

    function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setFileIsOverSurface(false);
    }

    function handleDrop(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();

        setFileIsOverSurface(false);

        const file = event.dataTransfer.files[0];
        if (file) {
            onFileDroppedAsync(file);
        }
    }

    return (
        <div className={css["drag-and-drop-file-surface"]}>
            <div className={css["instruction-container"]}>
                <i className={classList("fas fa-file-upload", css["upload-icon"])}></i>
                <div className="no-select">{fileIsOverSurface ? Strings.ReleaseToUpload : Strings.DragAndDrop}</div>
            </div>

            {errorMessage && (
                <div className={css["error-label-container"]}>
                    <NoticeLabel severity="error">{errorMessage}</NoticeLabel>
                </div>
            )}

            {/*
            Use a transparent div over everything to detect drop events.
            We can't use drag-and-drop-file-surface directly because child elements interfere with the drag events.
            */}
            <div
                className={css["droppable-surface"]}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
            />
        </div>
    );
};
