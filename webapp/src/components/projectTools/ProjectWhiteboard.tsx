import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { ImageEditor } from "../ImageEditor/ImageEditor";
import { MAX_PROJECT_NOTE_LENGTH } from "../../projectNotes";
import { ProjectWhiteboardMenu } from "./ProjectWhiteboardMenu";
import { useProjectWhiteboard } from "./useProjectWhiteboard";

export interface ProjectWhiteboardProps {
    headerId: string;
    notes?: pxt.workspace.ProjectNotes;
    active: boolean;
    renderHeader: (name: string, actions?: React.ReactNode) => React.ReactNode;
}

export function ProjectWhiteboard(props: ProjectWhiteboardProps): JSX.Element {
    const {
        notes,
        activeBoard,
        store,
        status,
        invalid,
        hasConflict,
        flush,
        updateText,
        selectBoard,
        renameBoard,
        addBoard,
        deleteBoard,
        resetBoard,
        keepLocalNotes,
        loadSavedNotes
    } = useProjectWhiteboard(props);
    const editor = React.useRef<ImageEditor>();

    React.useEffect(() => {
        if (!props.active || !editor.current) return undefined;

        const root = document.getElementById("project-whiteboard-canvas");
        const observer = new ResizeObserver(() => editor.current?.onResize());
        observer.observe(root);
        return () => observer.disconnect();
    }, [props.active, invalid, store]);

    const actions = props.active && !invalid && (
        <ProjectWhiteboardMenu
            notes={notes}
            onSelect={selectBoard}
            onRename={renameBoard}
            onAdd={addBoard}
            onDelete={deleteBoard}
        />
    );

    return (
        <>
            {props.renderHeader(activeBoard.name, actions)}
            <div className="project-whiteboard-body">
                {invalid ? (
                    <div
                        className="project-whiteboard-invalid"
                        role="alert"
                    >
                        <p>{lf("These notes could not be opened. The saved data has not been changed.")}</p>
                        <Button
                            type="button"
                            className="project-tools-button"
                            label={lf("Start a new whiteboard")}
                            title={lf("Start a new whiteboard")}
                            onClick={resetBoard}
                        />
                    </div>
                ) : (
                    <div
                        className="project-whiteboard"
                        onBlur={flush}
                    >
                        <p
                            id="project-notes-privacy"
                            className="project-whiteboard-privacy"
                        >
                            <i
                                className="icon lock"
                                aria-hidden="true"
                            />
                            {lf("Private project notes: not included when sharing")}
                        </p>
                        {hasConflict && (
                            <div
                                role="alert"
                                className="project-whiteboard-conflict"
                            >
                                <p>{lf("Saved notes changed while you were editing. Choose which version to keep.")}</p>
                                <Button
                                    type="button"
                                    className="project-tools-button"
                                    label={lf("Keep my notes")}
                                    title={lf("Keep my notes")}
                                    onClick={keepLocalNotes}
                                />
                                <Button
                                    type="button"
                                    className="project-tools-button"
                                    label={lf("Load saved notes")}
                                    title={lf("Load saved notes")}
                                    onClick={loadSavedNotes}
                                />
                            </div>
                        )}
                        <div
                            id="project-whiteboard-canvas"
                            className="project-whiteboard-canvas"
                            role="group"
                            aria-label={lf("Project sketch editor")}
                        >
                            {props.active && (
                                <ImageEditor
                                    key={activeBoard.id}
                                    ref={editor}
                                    store={store}
                                    singleFrame
                                    hideDoneButton
                                    hideAssetName
                                    scopedShortcuts
                                />
                            )}
                        </div>
                        <label htmlFor="project-notes-text">{lf("Notes")}</label>
                        <textarea
                            id="project-notes-text"
                            value={activeBoard.text}
                            maxLength={MAX_PROJECT_NOTE_LENGTH}
                            aria-describedby="project-notes-privacy"
                            placeholder={lf("Ideas, reminders, things to try…")}
                            onChange={event => updateText(event.target.value)}
                        />
                        {status === "error" && (
                            <div
                                className="project-whiteboard-status"
                                role="alert"
                            >
                                {lf("Notes could not be saved.")}
                                <Button
                                    type="button"
                                    className="project-tools-button"
                                    label={lf("Retry")}
                                    title={lf("Retry")}
                                    onClick={flush}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
