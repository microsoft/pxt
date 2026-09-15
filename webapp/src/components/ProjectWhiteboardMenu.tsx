import * as React from "react";
import { FocusTrap } from "../../../react-common/components/controls/FocusTrap";
import { MenuDropdown, MenuItem } from "../../../react-common/components/controls/MenuDropdown";
import { MAX_PROJECT_WHITEBOARDS, MAX_WHITEBOARD_NAME_LENGTH, nextWhiteboardName, whiteboardNameError } from "../projectNotes";

interface ProjectWhiteboardMenuProps {
    notes: pxt.workspace.ProjectNotes;
    onSelect: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onAdd: (name: string) => void;
    onDelete: (id: string) => void;
}

export function ProjectWhiteboardMenu(props: ProjectWhiteboardMenuProps): JSX.Element {
    const [edit, setEdit] = React.useState<
        { kind: "new"; name: string } | { kind: "rename" | "delete"; id: string; name: string }
    >();
    const [error, setError] = React.useState<string>();
    const input = React.useRef<HTMLInputElement>();
    const active = props.notes.whiteboards.find(board => board.id === props.notes.activeWhiteboardId);

    React.useEffect(() => {
        if (edit && edit.kind !== "delete") { input.current?.focus(); input.current?.select(); }
    }, [edit?.kind]);

    const close = () => {
        setEdit(undefined);
        setError(undefined);
        document.getElementById("project-whiteboard-menu")?.focus();
    };
    const items: MenuItem[] = props.notes.whiteboards.map(board => ({
        role: "menuitemcheckbox", label: board.name, isChecked: board.id === active.id,
        onChange: () => props.onSelect(board.id)
    }));
    items.push({ role: "separator" }, {
        role: "menuitem", label: lf("Rename whiteboard"), title: lf("Rename whiteboard"),
        leftIcon: "icon pencil", onClick: () => { setError(undefined); setEdit({ kind: "rename", id: active.id, name: active.name }); }
    }, {
        role: "menuitem", label: lf("New whiteboard"),
        title: props.notes.whiteboards.length < MAX_PROJECT_WHITEBOARDS ? lf("New whiteboard")
            : lf("You can have up to {0} whiteboards per project.", MAX_PROJECT_WHITEBOARDS),
        leftIcon: "icon plus", disabled: props.notes.whiteboards.length >= MAX_PROJECT_WHITEBOARDS,
        onClick: () => { setError(undefined); setEdit({ kind: "new", name: nextWhiteboardName(props.notes) }); }
    });
    if (props.notes.whiteboards.length > 1) items.push({ role: "separator" }, {
        role: "menuitem", label: lf("Delete whiteboard"), title: lf("Delete whiteboard"),
        leftIcon: "icon trash", onClick: () => { setError(undefined); setEdit({ kind: "delete", id: active.id, name: active.name }); }
    });

    return <div className="project-whiteboard-menu">
        <MenuDropdown id="project-whiteboard-menu" title={lf("Whiteboards")} ariaLabel={lf("Whiteboards")}
            icon="icon list" items={items} />
        {edit && <FocusTrap role={edit.kind === "delete" ? "alertdialog" : "dialog"}
            ariaLabel={edit.kind === "delete" ? lf("Delete whiteboard {0}?", edit.name)
                : edit.kind === "rename" ? lf("Rename whiteboard") : lf("New whiteboard")}
            className="project-whiteboard-menu__edit" onEscape={close} dontRestoreFocus focusFirstItem>
            {edit.kind === "delete" ? <>
                <p>{lf("Delete “{0}” and its drawing and notes? This cannot be undone.", edit.name)}</p>
                {error && <p role="alert">{error}</p>}
                <div className="project-whiteboard-menu__actions">
                    <button type="button" onClick={close}>{lf("Cancel")}</button>
                    <button type="button" onClick={() => {
                        try {
                            props.onDelete(edit.id);
                            close();
                        } catch (error) {
                            setError(error instanceof Error ? error.message : lf("The whiteboard could not be deleted."));
                        }
                    }}>{lf("Delete")}</button>
                </div>
            </> : <form onSubmit={event => {
                event.preventDefault();
                const error = whiteboardNameError(edit.name, props.notes, edit.kind === "rename" ? edit.id : undefined);
                if (error) { setError(error); input.current?.focus(); return; }
                try {
                    if (edit.kind === "rename") props.onRename(edit.id, edit.name);
                    else props.onAdd(edit.name);
                    close();
                } catch (error) {
                    setError(error instanceof Error ? error.message : lf("The whiteboard could not be updated."));
                }
            }}>
                <label htmlFor="project-whiteboard-name">{lf("Whiteboard name")}</label>
                <input id="project-whiteboard-name" ref={input} type="text" value={edit.name}
                    maxLength={MAX_WHITEBOARD_NAME_LENGTH} aria-invalid={!!error}
                    aria-describedby={error ? "project-whiteboard-name-error" : undefined}
                    onChange={event => { setEdit({ ...edit, name: event.target.value }); setError(undefined); }} />
                {error && <p id="project-whiteboard-name-error" role="alert">{error}</p>}
                <div className="project-whiteboard-menu__actions">
                    <button type="button" onClick={close}>{lf("Cancel")}</button>
                    <button type="submit">{edit.kind === "rename" ? lf("Save") : lf("Add")}</button>
                </div>
            </form>}
        </FocusTrap>}
    </div>;
}