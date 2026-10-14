import * as React from "react";
import { Action, createStore, Store } from "redux";
import imageReducer, { AnimationState, ImageEditorStore } from "../ImageEditor/store/imageReducer";
import { dispatchDisableResize, dispatchOpenAsset } from "../ImageEditor/actions/dispatch";
import { imageStateToBitmap } from "../ImageEditor/util";
import {
    addProjectWhiteboard,
    createProjectNotes,
    decodeWhiteboard,
    deleteProjectWhiteboard,
    ProjectNotesSaveQueue,
    renameProjectWhiteboard,
    validateProjectNotes,
    WHITEBOARD_HEIGHT,
    WHITEBOARD_WIDTH
} from "../../projectNotes";
import * as workspace from "../../workspace";

interface ProjectWhiteboardOptions {
    headerId: string;
    notes?: pxt.workspace.ProjectNotes;
    active: boolean;
}

interface ProjectWhiteboardState {
    notes: pxt.workspace.ProjectNotes;
    activeBoard: pxt.workspace.ProjectWhiteboard;
    store: Store<ImageEditorStore>;
    status: "saved" | "saving" | "error";
    invalid: boolean;
    hasConflict: boolean;
    flush: () => void;
    updateText: (text: string) => void;
    selectBoard: (id: string) => void;
    renameBoard: (id: string, name: string) => void;
    addBoard: (name: string) => void;
    deleteBoard: (id: string) => void;
    resetBoard: () => void;
    keepLocalNotes: () => void;
    loadSavedNotes: () => void;
}


function createNoteState(notes?: pxt.workspace.WhiteboardContent): ImageEditorStore {
    const bitmap = notes?.image
        ? decodeWhiteboard(notes.image)
        : new pxt.sprite.Bitmap(WHITEBOARD_WIDTH, WHITEBOARD_HEIGHT);
    const asset: pxt.ProjectImage = {
        id: "private-project-whiteboard",
        internalID: -1,
        type: pxt.AssetType.Image,
        bitmap: bitmap.data(),
        jresData: "",
        meta: {}
    };
    let state = imageReducer(undefined, dispatchOpenAsset(asset, false));
    if (notes?.palette) {
        state = {
            ...state,
            store: {
                ...state.store,
                present: {
                    ...state.store.present,
                    colors: notes.palette.slice()
                }
            }
        };
    }

    return imageReducer(state, dispatchDisableResize());
}

function noteReducer(state: ImageEditorStore, action: Action & { notes?: pxt.workspace.WhiteboardContent }): ImageEditorStore {
    return action.type === "project-notes-load" ? createNoteState(action.notes) : imageReducer(state, action);
}

export function useProjectWhiteboard(props: ProjectWhiteboardOptions): ProjectWhiteboardState {
    const initial = React.useMemo(() => {
        try {
            return {
                notes: props.notes === undefined ? createProjectNotes() : validateProjectNotes(props.notes),
                invalid: false
            };
        } catch {
            return { notes: createProjectNotes(), invalid: true };
        }
    }, []);
    const [notes, setNotes] = React.useState(initial.notes);
    const activeBoard = notes.whiteboards.find(board => board.id === notes.activeWhiteboardId);

    // Each board retains its own undo history and tool selection.
    const stores = React.useRef(new Map<string, Store<ImageEditorStore>>());
    if (!stores.current.has(activeBoard.id)) {
        stores.current.set(activeBoard.id, createStore(noteReducer, createNoteState(activeBoard)));
    }
    const store = stores.current.get(activeBoard.id);

    const [status, setStatus] = React.useState<"saved" | "saving" | "error">("saved");
    const [invalid, setInvalid] = React.useState(initial.invalid);
    const [conflict, setConflict] = React.useState<{ notes?: pxt.workspace.ProjectNotes }>();

    const draft = React.useRef(initial.notes);
    const dirty = React.useRef(false);
    const alive = React.useRef(true);
    const timer = React.useRef<number>();
    const revision = React.useRef(0);
    const inFlight = React.useRef(0);
    const saveQueue = React.useRef(new ProjectNotesSaveQueue());
    const applying = React.useRef(false);
    const incoming = React.useRef(JSON.stringify(props.notes));
    const ownSaves = React.useRef(new Set<string>());
    const conflictPending = React.useRef(false);

    const persist = React.useCallback((snapshot: pxt.workspace.ProjectNotes, savedRevision: number) => {
        ++inFlight.current;
        ownSaves.current.add(JSON.stringify(snapshot));
        if (ownSaves.current.size > 10) {
            ownSaves.current.delete(ownSaves.current.values().next().value);
        }
        if (alive.current) {
            setStatus("saving");
        }

        // Finish saving to this project even if another project has been opened.
        saveQueue.current.enqueue(() => workspace.saveProjectNotesAsync(props.headerId, snapshot)).then(() => {
            if (alive.current && revision.current === savedRevision) {
                setStatus("saved");
            }
        }).catch(error => {
            if (revision.current === savedRevision) {
                dirty.current = true;
            }
            if (alive.current) {
                setStatus("error");
            }
            pxt.reportException(error);
        }).finally(() => {
            --inFlight.current;
        });
    }, [props.headerId]);

    const flush = React.useCallback(() => {
        clearTimeout(timer.current);
        if (!dirty.current || conflictPending.current) {
            return;
        }

        dirty.current = false;
        persist(draft.current, revision.current);
    }, [persist]);

    const update = React.useCallback((notes: pxt.workspace.ProjectNotes) => {
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
        update({
            ...notes,
            whiteboards: notes.whiteboards.map(board => board.id === id ? { ...board, ...content } : board)
        });
    }, [update]);

    const loadNotes = React.useCallback((notes?: pxt.workspace.ProjectNotes, persistAfterPending = false) => {
        const validated = notes === undefined ? createProjectNotes() : validateProjectNotes(notes);
        clearTimeout(timer.current);
        dirty.current = false;
        draft.current = validated;
        ++revision.current;
        const loadedRevision = revision.current;

        applying.current = true;
        for (const [id, store] of stores.current) {
            const board = validated.whiteboards.find(board => board.id === id);
            if (board) {
                store.dispatch({ type: "project-notes-load", notes: board });
            } else {
                stores.current.delete(id);
            }
        }
        applying.current = false;

        setNotes(validated);
        conflictPending.current = false;
        setConflict(undefined);
        if (persistAfterPending) {
            persist(validated, loadedRevision);
        } else {
            setStatus("saved");
        }
    }, [persist]);

    React.useEffect(() => {
        const serialized = JSON.stringify(props.notes);
        if (serialized === incoming.current) {
            return;
        }

        incoming.current = serialized;
        const ownSave = ownSaves.current.delete(serialized);
        if (serialized === JSON.stringify(draft.current) || ownSave) {
            return;
        }

        try {
            if (dirty.current || inFlight.current) {
                clearTimeout(timer.current);
                conflictPending.current = true;
                setConflict({ notes: props.notes });
            } else {
                loadNotes(props.notes);
            }
        } catch {
            setInvalid(true);
        }
    }, [props.notes, loadNotes]);

    React.useEffect(() => {
        let previous = store.getState().store.present;
        const unsubscribe = store.subscribe(() => {
            const present = store.getState().store.present;
            if (present === previous) {
                return; // Ignore cursor movement/tool changes.
            }

            previous = present;
            if (applying.current) {
                return;
            }

            const animation = present as AnimationState;
            const bitmap = imageStateToBitmap(animation.frames[0]);
            const image = pxt.sprite.base64EncodeBitmap(bitmap.data());
            const board = draft.current.whiteboards.find(board => board.id === activeBoard.id);
            if (!board || image === board.image) {
                return;
            }

            updateBoard(board.id, { image, palette: present.colors.slice() });
        });

        return unsubscribe;
    }, [store, activeBoard.id, updateBoard]);

    React.useEffect(() => {
        alive.current = true;
        const onVisibilityChange = () => {
            if (document.hidden) {
                flush();
            }
        };

        window.addEventListener("pagehide", flush);
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            alive.current = false;
            window.removeEventListener("pagehide", flush);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            flush();
        };
    }, [flush]);

    React.useEffect(() => {
        if (!props.active) {
            flush();
        }
    }, [props.active, flush]);

    const commit = (notes: pxt.workspace.ProjectNotes) => {
        update(notes);
        flush();
    };

    const selectBoard = (id: string): void => {
        if (id !== draft.current.activeWhiteboardId) {
            commit({ ...draft.current, activeWhiteboardId: id });
        }
    };

    const renameBoard = (id: string, name: string): void => {
        commit(renameProjectWhiteboard(draft.current, id, name));
    };

    const addBoard = (name: string): void => {
        commit(addProjectWhiteboard(draft.current, name));
    };

    const deleteBoard = (id: string): void => {
        const remaining = deleteProjectWhiteboard(draft.current, id);
        stores.current.delete(id);
        commit(remaining);
    };

    const resetBoard = (): void => {
        const notes = createProjectNotes();
        loadNotes(notes);
        setInvalid(false);
        update(notes);
    };

    const keepLocalNotes = (): void => {
        conflictPending.current = false;
        setConflict(undefined);
        dirty.current = true;
        flush();
    };

    return {
        notes,
        activeBoard,
        store,
        status,
        invalid,
        hasConflict: !!conflict,
        flush,
        updateText: text => updateBoard(activeBoard.id, { text }),
        selectBoard,
        renameBoard,
        addBoard,
        deleteBoard,
        resetBoard,
        keepLocalNotes,
        loadSavedNotes: () => loadNotes(conflict.notes, true)
    };
}
