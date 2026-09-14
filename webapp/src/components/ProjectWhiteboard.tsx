import * as React from "react";
import { Action, createStore, Store } from "redux";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import imageReducer, { AnimationState, ImageEditorStore } from "./ImageEditor/store/imageReducer";
import { dispatchDisableResize, dispatchOpenAsset } from "./ImageEditor/actions/dispatch";
import { imageStateToBitmap } from "./ImageEditor/util";
import { addProjectWhiteboard, decodeWhiteboard, deleteProjectWhiteboard, MAX_PROJECT_NOTE_LENGTH, normalizeProjectNotes, renameProjectWhiteboard, WHITEBOARD_HEIGHT, WHITEBOARD_WIDTH } from "../projectNotes";
import { ProjectWhiteboardMenu } from "./ProjectWhiteboardMenu";
import * as workspace from "../workspace";

interface ProjectWhiteboardProps {
    headerId: string;
    notes?: pxt.workspace.ProjectNotes;
    active: boolean;
    renderHeader: (name: string, actions?: React.ReactNode) => React.ReactNode;
}

function createNoteState(notes?: pxt.workspace.WhiteboardContent): ImageEditorStore {
    const bitmap = notes?.image ? decodeWhiteboard(notes.image) : new pxt.sprite.Bitmap(WHITEBOARD_WIDTH, WHITEBOARD_HEIGHT);
    const asset: pxt.ProjectImage = {
        id: "private-project-whiteboard", internalID: -1, type: pxt.AssetType.Image,
        bitmap: bitmap.data(), jresData: "", meta: {}
    };
    let state = imageReducer(undefined, dispatchOpenAsset(asset, false));
    if (notes?.palette) state = { ...state, store: { ...state.store, present: { ...state.store.present, colors: notes.palette.slice() } } };
    return imageReducer(state, dispatchDisableResize());
}

function noteReducer(state: ImageEditorStore, action: Action & { notes?: pxt.workspace.WhiteboardContent }): ImageEditorStore {
    return action.type === "project-notes-load" ? createNoteState(action.notes) : imageReducer(state, action);
}

export function ProjectWhiteboard(props: ProjectWhiteboardProps) {
    const initial = React.useMemo(() => {
        try { return { notes: normalizeProjectNotes(props.notes), invalid: false }; }
        catch { return { notes: normalizeProjectNotes(), invalid: true }; }
    }, []);
    const [notes, setNotes] = React.useState(initial.notes);
    const activeBoard = notes.whiteboards.find(board => board.id === notes.activeWhiteboardId);
    // Keep each board's undo history and selected tools separate while switching.
    const stores = React.useRef(new Map<string, Store<ImageEditorStore>>());
    if (!stores.current.has(activeBoard.id)) stores.current.set(activeBoard.id, createStore(noteReducer, createNoteState(activeBoard)));
    const store = stores.current.get(activeBoard.id);
    const [status, setStatus] = React.useState<"saved" | "saving" | "error">("saved");
    const [invalid, setInvalid] = React.useState(initial.invalid);
    const [conflict, setConflict] = React.useState<{ notes?: pxt.workspace.ProjectNotes }>();
    const editor = React.useRef<ImageEditor>();
    const draft = React.useRef(initial.notes);
    const dirty = React.useRef(false);
    const alive = React.useRef(true);
    const timer = React.useRef<number>();
    const revision = React.useRef(0);
    const inFlight = React.useRef(0);
    const applying = React.useRef(false);
    const incoming = React.useRef(JSON.stringify(props.notes));
    const ownSaves = React.useRef(new Set<string>());
    const conflictPending = React.useRef(false);

    const flush = React.useCallback(() => {
        clearTimeout(timer.current);
        if (!dirty.current || conflictPending.current) return;
        dirty.current = false;
        const savedRevision = revision.current;
        const snapshot = draft.current;
        ++inFlight.current;
        ownSaves.current.add(JSON.stringify(snapshot));
        if (ownSaves.current.size > 10) ownSaves.current.delete(ownSaves.current.values().next().value);
        if (alive.current) setStatus("saving");
        // Capture the project ID, not the current global main package. Switching
        // projects must never save an old canvas into the newly opened project.
        Promise.resolve().then(() => workspace.saveProjectNotesAsync(props.headerId, snapshot)).then(() => {
            if (alive.current && revision.current === savedRevision) setStatus("saved");
        }).catch(error => {
            if (revision.current === savedRevision) dirty.current = true;
            if (alive.current) setStatus("error");
            pxt.reportException(error);
        }).finally(() => {
            --inFlight.current;
        });
    }, [props.headerId]);

    const update = React.useCallback((notes: pxt.workspace.ProjectNotesV2) => {
        draft.current = notes;
        setNotes(notes);
        dirty.current = true;
        ++revision.current;
        setStatus("saving");
        clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 500);
    }, [flush]);

    const updateBoard = React.useCallback((id: string, content: Partial<pxt.workspace.WhiteboardContent>) => {
        const notes = draft.current;
        update({ ...notes, whiteboards: notes.whiteboards.map(board => board.id === id ? { ...board, ...content } : board) });
    }, [update]);

    const loadNotes = React.useCallback((notes?: pxt.workspace.ProjectNotes) => {
        const validated = normalizeProjectNotes(notes);
        clearTimeout(timer.current);
        dirty.current = false;
        draft.current = validated;
        ++revision.current;
        applying.current = true;
        for (const [id, store] of stores.current) {
            const board = validated.whiteboards.find(board => board.id === id);
            if (board) store.dispatch({ type: "project-notes-load", notes: board });
            else stores.current.delete(id);
        }
        applying.current = false;
        setNotes(validated);
        setStatus("saved");
        conflictPending.current = false;
        setConflict(undefined);
    }, []);

    React.useEffect(() => {
        const serialized = JSON.stringify(props.notes);
        if (serialized === incoming.current) return;
        incoming.current = serialized;
        const ownSave = ownSaves.current.delete(serialized);
        if (serialized === JSON.stringify(draft.current) || ownSave) return;
        try {
            if (dirty.current || inFlight.current) {
                clearTimeout(timer.current);
                conflictPending.current = true;
                setConflict({ notes: props.notes });
            } else loadNotes(props.notes);
        } catch { setInvalid(true); }
    }, [props.notes, loadNotes]);

    React.useEffect(() => {
        let previous = store.getState().store.present;
        const unsubscribe = store.subscribe(() => {
            const present = store.getState().store.present;
            if (present === previous) return; // Ignore cursor movement/tool changes.
            previous = present;
            if (applying.current) return;
            const animation = present as AnimationState;
            const bitmap = imageStateToBitmap(animation.frames[0]);
            const image = pxt.sprite.base64EncodeBitmap(bitmap.data());
            const board = draft.current.whiteboards.find(board => board.id === activeBoard.id);
            if (!board || image === board.image) return;
            updateBoard(board.id, { image, palette: present.colors.slice() });
        });
        return unsubscribe;
    }, [store, activeBoard.id, updateBoard]);

    React.useEffect(() => {
        alive.current = true;
        const onVisibilityChange = () => { if (document.hidden) flush(); };
        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            alive.current = false;
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            flush();
        };
    }, [flush]);

    React.useEffect(() => { if (!props.active) flush(); }, [props.active, flush]);

    React.useEffect(() => {
        if (!props.active || !editor.current) return undefined;
        const root = document.getElementById("project-whiteboard-canvas");
        const observer = new ResizeObserver(() => editor.current?.onResize());
        observer.observe(root);
        return () => observer.disconnect();
    }, [props.active, invalid, store]);

    const commit = (notes: pxt.workspace.ProjectNotesV2) => { update(notes); flush(); };
    const actions = props.active && !invalid && <ProjectWhiteboardMenu notes={notes}
        onSelect={id => { if (id !== draft.current.activeWhiteboardId) commit({ ...draft.current, activeWhiteboardId: id }); }}
        onRename={(id, name) => commit(renameProjectWhiteboard(draft.current, id, name))}
        onAdd={name => commit(addProjectWhiteboard(draft.current, name))}
        onDelete={id => {
            const remaining = deleteProjectWhiteboard(draft.current, id);
            stores.current.delete(id);
            commit(remaining);
        }} />;

    return <>
        {props.renderHeader(activeBoard.name, actions)}
        <div className="project-whiteboard__body">
            {invalid ? <div className="project-whiteboard__invalid" role="alert">
                <p>{lf("These notes could not be opened. The saved data has not been changed.")}</p>
                <button type="button" onClick={() => {
                    const notes = normalizeProjectNotes();
                    loadNotes(notes);
                    setInvalid(false);
                    update(notes);
                }}>{lf("Start a new whiteboard")}</button>
            </div> : <div className="project-whiteboard" onBlur={flush}>
                <p id="project-notes-privacy" className="project-whiteboard__privacy">
                    <i className="icon lock" aria-hidden="true" />
                    {lf("Private project notes: not included when sharing")}
                </p>
                {conflict && <div role="alert" className="project-whiteboard__conflict">
                    <p>{lf("Saved notes changed while you were editing. Choose which version to keep.")}</p>
                    <button type="button" onClick={() => { conflictPending.current = false; setConflict(undefined); dirty.current = true; flush(); }}>{lf("Keep my notes")}</button>
                    <button type="button" onClick={() => loadNotes(conflict.notes)}>{lf("Load saved notes")}</button>
                </div>}
                <div id="project-whiteboard-canvas" className="project-whiteboard__canvas" aria-label={lf("Project sketch editor")}>
                    {props.active && <ImageEditor key={activeBoard.id} ref={editor} store={store} singleFrame hideDoneButton hideAssetName scopedShortcuts />}
                </div>
                <label htmlFor="project-notes-text">{lf("Notes")}</label>
                <textarea id="project-notes-text" value={activeBoard.text} maxLength={MAX_PROJECT_NOTE_LENGTH}
                    aria-describedby="project-notes-privacy" placeholder={lf("Ideas, reminders, things to try…")}
                    onChange={event => updateBoard(activeBoard.id, { text: event.target.value })} />
                {status === "error" && <div className="project-whiteboard__status" role="alert">
                    {lf("Notes could not be saved.")}
                    <button type="button" onClick={flush}>{lf("Retry")}</button>
                </div>}
            </div>}
        </div>
    </>;
}