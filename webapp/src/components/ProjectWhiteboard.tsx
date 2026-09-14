import * as React from "react";
import { Action, createStore } from "redux";
import { ImageEditor } from "./ImageEditor/ImageEditor";
import imageReducer, { AnimationState, ImageEditorStore } from "./ImageEditor/store/imageReducer";
import { dispatchDisableResize, dispatchOpenAsset } from "./ImageEditor/actions/dispatch";
import { imageStateToBitmap } from "./ImageEditor/util";
import { decodeWhiteboard, MAX_PROJECT_NOTE_LENGTH, validateProjectNotes, WHITEBOARD_HEIGHT, WHITEBOARD_WIDTH } from "../projectNotes";
import * as workspace from "../workspace";

interface ProjectWhiteboardProps {
    headerId: string;
    notes?: pxt.workspace.ProjectNotes;
    active: boolean;
}

function createNoteState(notes?: pxt.workspace.ProjectNotes): ImageEditorStore {
    const bitmap = notes?.image ? decodeWhiteboard(notes.image) : new pxt.sprite.Bitmap(WHITEBOARD_WIDTH, WHITEBOARD_HEIGHT);
    const asset: pxt.ProjectImage = {
        id: "private-project-whiteboard", internalID: -1, type: pxt.AssetType.Image,
        bitmap: bitmap.data(), jresData: "", meta: {}
    };
    let state = imageReducer(undefined, dispatchOpenAsset(asset, false));
    if (notes?.palette) state = { ...state, store: { ...state.store, present: { ...state.store.present, colors: notes.palette.slice() } } };
    return imageReducer(state, dispatchDisableResize());
}

function noteReducer(state: ImageEditorStore, action: Action & { notes?: pxt.workspace.ProjectNotes }): ImageEditorStore {
    return action.type === "project-notes-load" ? createNoteState(action.notes) : imageReducer(state, action);
}

export function ProjectWhiteboard(props: ProjectWhiteboardProps) {
    const initial = React.useMemo(() => {
        try { return { notes: props.notes ? validateProjectNotes(props.notes) : undefined, invalid: false }; }
        catch { return { notes: undefined, invalid: true }; }
    }, []);
    const store = React.useMemo(() => createStore(noteReducer, createNoteState(initial.notes)), []);
    const [text, setText] = React.useState(initial.notes?.text || "");
    const [status, setStatus] = React.useState<"saved" | "saving" | "error">("saved");
    const [invalid, setInvalid] = React.useState(initial.invalid);
    const [conflict, setConflict] = React.useState<{ notes?: pxt.workspace.ProjectNotes }>();
    const editor = React.useRef<ImageEditor>();
    const draft = React.useRef<pxt.workspace.ProjectNotes>(initial.notes || { version: 1, text: "" });
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

    const update = React.useCallback((notes: pxt.workspace.ProjectNotes) => {
        draft.current = notes;
        dirty.current = true;
        ++revision.current;
        setStatus("saving");
        clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 500);
    }, [flush]);

    const loadNotes = React.useCallback((notes?: pxt.workspace.ProjectNotes) => {
        const validated = notes ? validateProjectNotes(notes) : { version: 1 as const, text: "" };
        clearTimeout(timer.current);
        dirty.current = false;
        draft.current = validated;
        ++revision.current;
        setText(validated.text);
        applying.current = true;
        store.dispatch({ type: "project-notes-load", notes: validated });
        applying.current = false;
        setStatus("saved");
        conflictPending.current = false;
        setConflict(undefined);
    }, [store]);

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
            if (image === draft.current.image) return;
            update({ version: 1, text: draft.current.text, image, palette: present.colors.slice() });
        });
        const onVisibilityChange = () => { if (document.hidden) flush(); };
        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            alive.current = false;
            unsubscribe();
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            flush();
        };
    }, [store, update, flush]);

    React.useEffect(() => { if (!props.active) flush(); }, [props.active, flush]);

    React.useEffect(() => {
        if (!props.active || !editor.current) return undefined;
        const root = document.getElementById("project-whiteboard-canvas");
        const observer = new ResizeObserver(() => editor.current?.onResize());
        observer.observe(root);
        return () => observer.disconnect();
    }, [props.active, invalid]);

    if (invalid) return <div className="project-whiteboard__invalid" role="alert">
        <p>{lf("These notes could not be opened. The saved data has not been changed.")}</p>
        <button type="button" onClick={() => {
            setInvalid(false);
            update({ version: 1, text: "" });
        }}>{lf("Start a new whiteboard")}</button>
    </div>;

    return <div className="project-whiteboard" onBlur={flush}>
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
            {props.active && <ImageEditor ref={editor} store={store} singleFrame hideDoneButton hideAssetName scopedShortcuts />}
        </div>
        <label htmlFor="project-notes-text">{lf("Notes")}</label>
        <textarea id="project-notes-text" value={text} maxLength={MAX_PROJECT_NOTE_LENGTH}
            aria-describedby="project-notes-privacy" placeholder={lf("Ideas, reminders, things to try…")}
            onChange={event => {
                setText(event.target.value);
                update({ ...draft.current, text: event.target.value });
            }} />
        {status === "error" && <div className="project-whiteboard__status" role="alert">
            {lf("Notes could not be saved.")}
            <button type="button" onClick={flush}>{lf("Retry")}</button>
        </div>}
    </div>;
}