import * as React from "react";
import { Modal } from "../../../react-common/components/controls/Modal";
import { BackpackEntry, MAX_BACKPACK_NAME_LENGTH } from "../backpack";

export interface BackpackItemEdit {
    kind: "rename" | "delete";
    key: string;
    name: string;
    entry: BackpackEntry;
}

export interface BackpackItemDialogProps {
    edit: BackpackItemEdit;
    pending: boolean;
    error?: string;
    nameInputRef: React.RefObject<HTMLInputElement>;
    onNameChange: (name: string) => void;
    onCancel: () => void;
    onRename: () => void;
    onDelete: () => void;
}

export function BackpackItemDialog(props: BackpackItemDialogProps): JSX.Element {
    const { edit, pending, error, nameInputRef, onNameChange, onCancel, onRename, onDelete } = props;
    const { kind, entry } = edit;

    return (
        <Modal
            title={kind === "rename" ? lf("Rename snippet") : lf("Delete snippet?")}
            className={`project-backpack__${kind}-modal`}
            ariaDescribedBy={kind === "delete" ? "project-backpack-delete-description" : undefined}
            onClose={onCancel}
            hideDismissButton={pending}
            actions={[
                { label: lf("Cancel"), className: "neutral", disabled: pending, onClick: onCancel },
                kind === "rename"
                    ? { label: lf("Save"), disabled: pending, onClick: onRename }
                    : { label: lf("Delete"), className: "red", disabled: pending, onClick: onDelete }
            ]}
        >
            {kind === "rename" ? <form
                className="project-backpack__rename-form"
                aria-busy={pending}
                onSubmit={event => {
                    event.preventDefault();
                    onRename();
                }}
            >
                <label htmlFor="project-backpack-name">{lf("Snippet name")}</label>
                <input
                    id="project-backpack-name"
                    ref={nameInputRef}
                    type="text"
                    value={edit.name}
                    disabled={pending}
                    maxLength={MAX_BACKPACK_NAME_LENGTH}
                    aria-invalid={!!error}
                    aria-describedby={error ? "project-backpack-name-error" : undefined}
                    onChange={event => onNameChange(event.target.value)}
                />
                {error && <p id="project-backpack-name-error" role="alert">{error}</p>}
            </form> : <div aria-busy={pending}>
                <p id="project-backpack-delete-description">{entry.source === "cloud"
                    ? lf("Delete {0} from your backpack on all devices?", entry.name)
                    : entry.local?.firstAttemptAt
                    ? lf("Delete the pending copy of {0} from this browser? Any copy already synced to your account will not be deleted.", entry.name)
                    : lf("Delete {0} from your backpack in this browser?", entry.name)}</p>
                {error && <p role="alert">{error}</p>}
            </div>}
        </Modal>
    );
}
