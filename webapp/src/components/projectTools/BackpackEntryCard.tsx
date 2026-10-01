import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { classList } from "../../../../react-common/components/util";
import { BackpackEntry, backpackEntryKey } from "../../backpack";
import { BackpackPreview } from "./BackpackPreview";

export interface BackpackEntryDependency {
    name: string;
    displayName: string;
    version: string;
}

export interface BackpackEntryCardProps {
    entry: BackpackEntry;
    headerId: string;
    active: boolean;
    signedIn: boolean;
    pending: boolean;
    canImport: boolean;
    canEditAsset: boolean;
    openingAsset: boolean;
    error?: string;
    errorRef: React.RefObject<HTMLParagraphElement>;
    missingDependencies: BackpackEntryDependency[];
    onEdit: () => void;
    onDelete: () => void;
    onRetrySync: () => void;
    onAdd: () => void;
    onDragStart?: React.DragEventHandler<HTMLElement>;
    onDragEnd: React.DragEventHandler<HTMLElement>;
}

export function BackpackEntryCard(props: BackpackEntryCardProps): JSX.Element {
    const {
        entry, headerId, active, signedIn, pending, canImport, canEditAsset,
        openingAsset, error, errorRef, missingDependencies,
        onEdit, onDelete, onRetrySync, onAdd, onDragStart, onDragEnd
    } = props;
    const item = entry.error ? undefined : entry.summary || entry.item;
    const editLabel = item?.kind === "asset" ? lf("Edit {0}", entry.name) : lf("Rename {0}", entry.name);
    const deleteLabel = lf("Delete {0}", entry.name);

    return (
        <li
            data-backpack-id={entry.id}
            data-backpack-key={backpackEntryKey(entry)}
            className={classList("project-backpack-item", entry.error && "project-backpack-item-invalid")}
        >
            <div className="project-backpack-item-header">
                <h3 className="project-backpack-name">{entry.name}</h3>
                <div className="project-backpack-item-actions">
                    {item && (
                        <Button
                            className="project-backpack-button project-backpack-icon-button project-backpack-rename"
                            type="button"
                            nativeBehavior
                            hardDisabled={pending || item.kind === "asset" && !canEditAsset}
                            title={editLabel}
                            ariaLabel={editLabel}
                            ariaHasPopup="dialog"
                            leftIcon="icon pencil"
                            onClick={onEdit}
                        />
                    )}
                    <Button
                        className="project-backpack-button project-backpack-icon-button project-backpack-delete"
                        type="button"
                        nativeBehavior
                        hardDisabled={pending}
                        title={deleteLabel}
                        ariaLabel={deleteLabel}
                        ariaHasPopup="dialog"
                        leftIcon="icon trash"
                        onClick={onDelete}
                    />
                </div>
            </div>
            {openingAsset && <p role="status">{lf("Opening asset editor…")}</p>}
            {error && (
                <p
                    ref={errorRef}
                    role="alert"
                >
                    {error}
                </p>
            )}
            {entry.error && <p className="project-backpack-invalid">{entry.error}</p>}
            {signedIn && entry.source === "local" && (
                <p>{entry.local?.firstAttemptAt
                    ? lf("Pending sync. A copy may already be saved to your account.")
                    : lf("Saved in this browser only.")}</p>
            )}
            {entry.pendingError && <p role="status">{entry.pendingError}</p>}
            {signedIn && entry.source === "local" && !!entry.item && (
                <Button
                    className="project-backpack-button project-backpack-sync"
                    type="button"
                    nativeBehavior
                    hardDisabled={pending}
                    label={lf("Retry sync")}
                    title={lf("Retry sync")}
                    onClick={onRetrySync}
                />
            )}
            {item && (
                <>
                    <BackpackPreview
                        entry={entry}
                        headerId={headerId}
                        active={active}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                    {!!Object.keys(item.projectBlocks || {}).length && (
                        <p className="project-backpack-requirements">
                            {lf(
                                "Uses project-defined blocks from {0}. Their source code is not included.",
                                Array.from(new Set(Object.values(item.projectBlocks))).join(", ")
                            )}
                        </p>
                    )}
                    {!!missingDependencies.length && (
                        <div className="project-backpack-requirements">
                            <p>{lf("Required extensions")}</p>
                            <ul>
                                {missingDependencies.map(({ name, displayName, version }) => (
                                    <li key={name}>
                                        <span>{displayName}</span>{" — "}<span>{version}</span>{" — "}
                                        <span>{lf("Missing from this project")}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="project-backpack-actions">
                        <Button
                            className="project-backpack-button project-backpack-icon-button project-backpack-add"
                            type="button"
                            nativeBehavior
                            hardDisabled={pending || !canImport}
                            ariaLabel={lf("Add {0} to project", item.name)}
                            ariaDescribedBy={!canImport ? "project-backpack-import-reason" : undefined}
                            title={lf("Add to project")}
                            leftIcon="icon plus"
                            onClick={onAdd}
                        />
                    </div>
                </>
            )}
        </li>
    );
}
