import * as React from "react";
import { Input } from "../../../react-common/components/controls/Input";
import { Modal } from "../../../react-common/components/controls/Modal";
import * as auth from "../auth";
import * as backpack from "../backpack";
import { createBackpackSearch } from "../backpackSearch";
import * as data from "../data";
import * as pkg from "../package";
import { BackpackPreview } from "./BackpackPreview";
import { BackpackAssetEditDialog } from "./BackpackAssetEditDialog";

export interface ProjectBackpackProps {
    headerId: string;
    active: boolean;
    tutorial?: boolean;
    openRequest?: backpack.BackpackOpenRequest;
    renderHeader: (title: string, actions?: React.ReactNode) => React.ReactNode;
    onSignIn: () => void;
    onModalOpenChange?: (open: boolean) => void;
}

function currentUserId(): string {
    return auth.loggedIn() ? auth.userProfile()?.id : undefined;
}

function entryKey(entry: backpack.BackpackEntry): string {
    return backpack.backpackEntryKey(entry);
}

function entryKind(entry: backpack.BackpackEntry): pxt.auth.BackpackKind {
    return entry.summary?.kind || entry.item?.kind || "code";
}

export function ProjectBackpack(props: ProjectBackpackProps): JSX.Element {
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    React.useLayoutEffect(() => {
        const subscriber: data.DataSubscriber = { subscriptions: [], onDataChanged: () => {
            backpack.notifyBackpackEditorChanged();
            update();
        } };
        data.subscribe(subscriber, auth.USER_PROFILE);
        data.subscribe(subscriber, auth.LOGGED_IN);
        update();
        return () => data.unsubscribe(subscriber);
    }, []);
    const userId = currentUserId();
    if (!backpack.isBackpackEnabled()) return null;
    const tutorial = props.tutorial || !!pkg.mainEditorPkg()?.header?.tutorial;
    // Guest/account transitions get fresh contents, including pending/error state.
    return <BackpackContents key={`${pxt.appTarget?.id}:${userId ? `user:${userId}` : "guest"}:${props.headerId}:${tutorial}`}
        {...props} tutorial={tutorial} userId={userId} />;
}

function BackpackContents(props: ProjectBackpackProps & { userId?: string }): JSX.Element {
    const [contents, setContents] = React.useState<backpack.BackpackState>({ entries: [] });
    const { entries: items, warning } = contents;
    const [kind, setKind] = React.useState<pxt.auth.BackpackKind>(props.tutorial ? "asset" : props.openRequest?.kind || "code");
    const codeUnavailable = props.tutorial && kind === "code";
    const [query, setQuery] = React.useState("");
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const [errorEntryKey, setErrorEntryKey] = React.useState<string>();
    const [openingAssetKey, setOpeningAssetKey] = React.useState<string>();
    const [edit, setEdit] = React.useState<{ kind: "rename" | "delete"; key: string; name: string; entry: backpack.BackpackEntry }>();
    const [assetEdit, setAssetEdit] = React.useState<{ entry: backpack.BackpackEntry; item: pxt.auth.BackpackItem;
        context: backpack.BackpackAssetEditorContext }>();
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    const alive = React.useRef(true);
    const active = React.useRef(props.active);
    active.current = props.active;
    const busy = React.useRef(false);
    const dragged = React.useRef<backpack.BackpackEntry>();
    const loaded = React.useRef(false);
    const body = React.useRef<HTMLDivElement>();
    const entryError = React.useRef<HTMLParagraphElement>();
    const searchInput = React.useRef<HTMLInputElement>();
    const nameInput = React.useRef<HTMLInputElement>();
    const kindButtons = React.useRef<HTMLButtonElement[]>([]);
    const focusAfter = React.useRef<{ key?: string; action?: "rename" | "delete" }>();
    const targetId = React.useRef(pxt.appTarget?.id);
    const isCurrent = () => alive.current && currentUserId() === props.userId && pxt.appTarget?.id === targetId.current;

    const searchItems = (entries: backpack.BackpackEntry[]) => createBackpackSearch(entries.filter(entry => entryKind(entry) === kind),
        name => Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name]?.config?.name : undefined);
    const search = React.useMemo(() => searchItems(items), [items, kind]);
    const filteredItems = React.useMemo(() => search(ready ? query : ""), [search, query, ready]);
    const categoryCount = items.filter(entry => entryKind(entry) === kind).length;

    const readItems = (): backpack.BackpackState => backpack.getBackpackState();
    const reportError = (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : lf("Could not update your backpack. Please try again."));
    };

    React.useEffect(() => {
        alive.current = true;
        const unsubscribe = backpack.subscribeBackpack(() => {
            if (!isCurrent()) return;
            update(); // Also observes editor eligibility and installed extensions.
            if (!loaded.current) return;
            try { setContents(readItems()); }
            catch (reason) { setContents({ entries: [] }); loaded.current = false; setReady(false); reportError(reason); }
        });
        return () => { alive.current = false; unsubscribe(); };
    }, []);

    const run = async (action: () => Promise<void>, errorKey?: string): Promise<void> => {
        if (busy.current || !isCurrent()) return;
        busy.current = true;
        setPending(true);
        setError(undefined);
        setErrorEntryKey(undefined);
        try { await action(); }
        catch (reason) {
            if (isCurrent()) { setErrorEntryKey(errorKey); reportError(reason); }
        }
        finally {
            if (isCurrent()) { busy.current = false; setPending(false); }
        }
    };

    const refresh = () => run(async () => {
        // Do not flash a cached snapshot before a refresh has been acknowledged.
        loaded.current = false;
        setReady(false);
        setContents({ entries: [] });
        setEdit(undefined);
        try { await backpack.refreshBackpackAsync(); }
        catch (reason) {
            if (isCurrent()) {
                const state = readItems();
                // Only explicitly incomplete new results, not a stale successful
                // snapshot from before an unavailable session, are recovery rows.
                setContents(state.complete === false ? state : { entries: [] });
                loaded.current = true;
            }
            throw reason;
        }
        if (!isCurrent()) return;
        setContents(readItems());
        loaded.current = true;
        setReady(true);
    });

    React.useLayoutEffect(() => { if (props.active) void refresh(); }, [props.active]);
    React.useEffect(() => {
        if (props.openRequest?.kind) {
            setKind(props.tutorial ? "asset" : props.openRequest.kind);
            setQuery("");
        }
    }, [props.openRequest]);

    const editedItem = edit?.entry;
    const modalOpen = (!!assetEdit || !!editedItem && (edit.kind === "delete" || !editedItem.error)) && props.active;
    const keepPanelOpen = (modalOpen || !!openingAssetKey) && props.active;
    React.useEffect(() => {
        props.onModalOpenChange?.(keepPanelOpen);
        return () => props.onModalOpenChange?.(false);
    }, [keepPanelOpen, props.onModalOpenChange]);
    React.useEffect(() => {
        if (!props.active) { setEdit(undefined); setAssetEdit(undefined); setOpeningAssetKey(undefined); }
    }, [props.active]);
    React.useEffect(() => {
        if (modalOpen && edit?.kind === "rename") {
            nameInput.current?.focus();
            nameInput.current?.select();
        }
    }, [modalOpen, edit?.kind, edit?.key]);
    React.useEffect(() => {
        if (pending || !focusAfter.current) return;
        const target = focusAfter.current;
        focusAfter.current = undefined;
        if (!active.current || !isCurrent()) return;
        const entry = Array.from(body.current?.querySelectorAll<HTMLElement>("[data-backpack-key]") || [])
            .find(element => element.dataset.backpackKey === target.key);
        const button = entry?.querySelector<HTMLButtonElement>(target.action
            ? `.project-backpack__${target.action}` : "button:not(:disabled)");
        (button || (query.trim() ? searchInput.current : body.current))?.focus();
    }, [pending, items, edit, assetEdit, query]);
    React.useEffect(() => {
        if (props.active && !pending && !modalOpen && errorEntryKey && error) {
            entryError.current?.scrollIntoView({ block: "nearest" });
        }
    }, [props.active, pending, modalOpen, errorEntryKey, error]);

    const cancelEdit = () => {
        if (busy.current) return;
        focusAfter.current = { key: edit.key, action: edit.kind };
        setEdit(undefined);
        setError(undefined);
    };
    const beginEdit = (item: backpack.BackpackEntry, kind: "rename" | "delete"): void => {
        if (busy.current || !isCurrent() || kind === "rename" && item.error) return;
        // The shared modal takes focus during its mount, before effects run.
        // Keep the owning panel open while focus moves into the portal.
        props.onModalOpenChange?.(true);
        setError(undefined);
        setEdit({ kind, key: entryKey(item), name: item.name, entry: item });
    };
    const deleteItem = (item: backpack.BackpackEntry) => run(async () => {
        const index = filteredItems.findIndex(entry => entryKey(entry) === entryKey(item));
        await backpack.deleteBackpackEntryAsync(item);
        if (!isCurrent()) return;
        const remaining = readItems();
        const visible = searchItems(remaining.entries)(query);
        const next = visible[index] || visible[index - 1];
        focusAfter.current = { key: next && entryKey(next) };
        setContents(remaining);
        setEdit(undefined);
    });
    const renameItem = () => run(async () => {
        await backpack.renameBackpackItemAsync(editedItem.id, edit.name, editedItem);
        if (!isCurrent()) return;
        focusAfter.current = { key: edit.key, action: "rename" };
        setContents(readItems());
        setEdit(undefined);
    });
    const addItem = (entry: backpack.BackpackEntry, position?: backpack.BackpackImportPosition) => run(async () => {
        await backpack.importBackpackEntryAsync(entry, props.headerId, position);
    });
    const editAsset = (entry: backpack.BackpackEntry) => run(async () => {
        // Disabling the focused pencil can blur it before a cloud read finishes.
        // Protect the panel before React commits pending, not just at portal mount.
        props.onModalOpenChange?.(true);
        setOpeningAssetKey(entryKey(entry));
        try {
            const item = await backpack.loadBackpackAssetAsync(entry);
            if (!isCurrent() || !active.current) return;
            const context = await backpack.getBackpackAssetEditorContextAsync(props.headerId);
            if (!isCurrent() || !active.current) return;
            setAssetEdit({ entry, item, context });
        } catch (reason) {
            if (isCurrent()) focusAfter.current = { key: entryKey(entry), action: "rename" };
            throw reason;
        } finally {
            if (isCurrent()) setOpeningAssetKey(undefined);
        }
    }, entryKey(entry));
    const closeAssetEdit = (): void => {
        focusAfter.current = { key: entryKey(assetEdit.entry), action: "rename" };
        setAssetEdit(undefined);
    };

    const canImport = !codeUnavailable && backpack.canImportBackpack(props.headerId, kind);
    const canEditAsset = backpack.canEditBackpackAsset(props.headerId);
    const dragType = "application/x-makecode-backpack";
    const startDrag = (event: React.DragEvent<HTMLElement>, entry: backpack.BackpackEntry): void => {
        if (busy.current || !isCurrent() || !active.current || modalOpen || !canImport) {
            event.preventDefault();
            return;
        }
        // Do not expose the PNG URI to the global project-file drop handler.
        event.dataTransfer.clearData();
        event.dataTransfer.setData(dragType, entryKey(entry));
        event.dataTransfer.effectAllowed = "copy";
        dragged.current = entry;
    };
    React.useEffect(() => {
        if (!props.active || !canImport || modalOpen) return undefined;
        const onDrag = (event: DragEvent): void => {
            if (!dragged.current || !event.dataTransfer?.types.includes(dragType)) return;
            event.preventDefault();
            event.stopPropagation();
            const allowed = !busy.current && isCurrent() && backpack.canDropBackpack(props.headerId, event.target, entryKind(dragged.current));
            event.dataTransfer.dropEffect = allowed ? "copy" : "none";
            if (event.type !== "drop") return;
            const entry = dragged.current;
            dragged.current = undefined;
            if (allowed && event.dataTransfer.getData(dragType) === entryKey(entry)) {
                void addItem(entry, { x: event.clientX, y: event.clientY });
            }
        };
        document.addEventListener("dragover", onDrag, true);
        document.addEventListener("drop", onDrag, true);
        return () => {
            dragged.current = undefined;
            document.removeEventListener("dragover", onDrag, true);
            document.removeEventListener("drop", onDrag, true);
        };
    }, [props.active, props.headerId, canImport, modalOpen, kind]);
    const header = pkg.mainEditorPkg()?.header;
    const importReason = !header || header.id !== props.headerId || pxt.shell.isReadOnly()
        || pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME
        ? lf("Open an editable Blocks project to add items from your backpack.")
        : lf("Switch to Blocks to add snippets");
    const message = !loaded.current && pending && props.active ? lf("Loading backpack…") : "";
    const displayedError = error || (!ready && !pending ? warning : undefined);
    const clearSearch = (): void => {
        setQuery("");
        searchInput.current?.focus();
    };

    return <>
        {props.renderHeader(lf("Backpack"), <div className="project-backpack__tabs" role="tablist" aria-label={lf("Backpack contents")}>
            {(["code", "asset"] as const).map((value, index) => <button key={value} id={`project-backpack-tab-${value}`}
                ref={element => kindButtons.current[index] = element} className="project-backpack__button" type="button" role="tab"
                aria-selected={kind === value} aria-controls="project-backpack-items" tabIndex={kind === value ? 0 : -1}
                disabled={pending} onClick={() => { setKind(value); setQuery(""); }} onKeyDown={event => {
                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                    event.preventDefault();
                    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
                    setKind(next ? "asset" : "code");
                    setQuery("");
                    kindButtons.current[next]?.focus();
                }}>{value === "code" ? lf("Code") : lf("Assets")}</button>)}
        </div>)}
        {!codeUnavailable && <div className="project-backpack__search" role="search" aria-label={lf("Backpack")}
            onKeyDown={event => {
                if (event.key === "Escape" && query && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.stopPropagation();
                    clearSearch();
                }
            }}>
            <Input id="project-backpack-search" className="project-backpack__search-input" type="search" role="searchbox"
                ariaLabel={lf("Search backpack")} placeholder={lf("Search backpack")}
                icon="icon search" initialValue={query} onChange={setQuery} handleInputRef={searchInput}
                disabled={ready && !categoryCount} />
            {!!query && <button className="project-backpack__button project-backpack__icon-button"
                type="button" onClick={clearSearch}
                aria-label={lf("Clear backpack search")} title={lf("Clear backpack search")}>
                <i className="icon remove" aria-hidden="true" />
            </button>}
        </div>}
        <div ref={body} id="project-backpack-items" className="project-backpack__body" tabIndex={-1} aria-busy={pending}
            role="tabpanel" aria-labelledby={`project-backpack-tab-${kind}`}>
            {codeUnavailable ? <p>{lf("Code snippets aren't available during tutorials. Use the Assets tab to add your own assets.")}</p> : <>
            {!props.userId && auth.hasIdentity() && <button className="project-backpack__button project-backpack__sign-in"
                type="button" onClick={props.onSignIn}>{lf("Sign in to save your backpack across browsers.")}</button>}
            <div role="status">
                {message && <p>{message}</p>}
                {warning && warning !== displayedError && <p>{warning}</p>}
                {!ready && !pending && !!items.length && <p>{lf("Some snippets could not be loaded. Retry to search the complete backpack.")}</p>}
                {ready && !!categoryCount && !!query.trim() && <p>{filteredItems.length
                    ? lf("{0} of {1} snippets", filteredItems.length, categoryCount)
                    : lf("No matching snippets.")}</p>}
            </div>
            {displayedError && !modalOpen && !errorEntryKey && <>
                <p role="alert">{displayedError}</p>
                {!ready && <button className="project-backpack__button project-backpack__retry" type="button" disabled={pending}
                    onClick={() => { focusAfter.current = {}; void refresh(); }}>{lf("Retry")}</button>}
            </>}
            {!canImport && <p id="project-backpack-import-reason">{importReason}</p>}
            {ready && !categoryCount && <div className="project-backpack__empty">
                <p>{!items.length ? lf("Your backpack is empty.") : kind === "asset" ? lf("No saved assets.") : lf("No saved code.")}</p>
                <p>{kind === "asset"
                    ? lf("Right-click or drag an image, animation, tilemap or music asset block into Backpack to save it here.")
                    : lf("Right-click or hold a block container and choose Add to Backpack, or drag blocks over the Backpack bubble, then drop them into the backpack.")}</p>
            </div>}
            {!!filteredItems.length && <ul className="project-backpack__list" aria-label={lf("Backpack snippets")}>
                {filteredItems.map(entry => {
                    const item = entry.error ? undefined : entry.summary || entry.item;
                    const missingDependencies = Object.entries(item?.dependencies || {}).filter(([name, version]) => {
                        const dependency = Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name] : undefined;
                        const installed = dependency && (version === "*" || dependency.verProtocol() === "github"
                            && version.startsWith("github:") && dependency.version().split("#")[0].toLowerCase() === version.split("#")[0].toLowerCase()
                            || dependency.version() === version);
                        return !installed;
                    });
                    return <li key={entryKey(entry)} data-backpack-id={entry.id} data-backpack-key={entryKey(entry)}
                        className={`project-backpack__item${entry.error ? " project-backpack__item--invalid" : ""}`}>
                        <div className="project-backpack__item-header">
                            <h3 className="project-backpack__name">{entry.name}</h3>
                            <div className="project-backpack__item-actions">
                                {item && <button className="project-backpack__button project-backpack__icon-button project-backpack__rename"
                                    type="button" disabled={pending || item.kind === "asset" && !canEditAsset}
                                    title={item.kind === "asset" ? lf("Edit {0}", entry.name) : lf("Rename {0}", entry.name)}
                                    aria-label={item.kind === "asset" ? lf("Edit {0}", entry.name) : lf("Rename {0}", entry.name)} aria-haspopup="dialog"
                                    onClick={() => item.kind === "asset" ? void editAsset(entry) : beginEdit(entry, "rename")}>
                                    <i className="icon pencil" aria-hidden="true" />
                                </button>}
                                <button className="project-backpack__button project-backpack__icon-button project-backpack__delete"
                                    type="button" disabled={pending} title={lf("Delete {0}", entry.name)}
                                    aria-label={lf("Delete {0}", entry.name)} aria-haspopup="dialog"
                                    onClick={() => beginEdit(entry, "delete")}>
                                    <i className="icon trash" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        {openingAssetKey === entryKey(entry) && <p role="status">{lf("Opening asset editor…")}</p>}
                        {error && !modalOpen && errorEntryKey === entryKey(entry) && <p ref={entryError} role="alert">{error}</p>}
                        {entry.error && <p className="project-backpack__invalid">{entry.error}</p>}
                        {!!props.userId && entry.source === "local" && <p>{entry.local?.firstAttemptAt
                            ? lf("Pending sync. A copy may already be saved to your account.")
                            : lf("Saved in this browser only.")}</p>}
                        {entry.pendingError && <p role="status">{entry.pendingError}</p>}
                        {!!props.userId && entry.source === "local" && !!entry.item && <button
                            className="project-backpack__button project-backpack__sync" type="button" disabled={pending}
                            onClick={() => void run(() => backpack.retryBackpackEntryAsync(entry))}>{lf("Retry sync")}</button>}
                        {item && <>
                            <BackpackPreview entry={entry} headerId={props.headerId} active={props.active}
                                onDragStart={canImport && !pending && !modalOpen ? event => startDrag(event, entry) : undefined}
                                onDragEnd={() => { dragged.current = undefined; }} />
                            {!!Object.keys(item.projectBlocks || {}).length && <p className="project-backpack__requirements">
                                {lf("Uses project-defined blocks from {0}. Their source code is not included.",
                                    Array.from(new Set(Object.values(item.projectBlocks))).join(", "))}
                            </p>}
                            {!!missingDependencies.length && <div className="project-backpack__requirements">
                                <p>{lf("Required extensions")}</p>
                                <ul>{missingDependencies.map(([name, version]) => {
                                    const dependency = Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name] : undefined;
                                    return <li key={name}>
                                        <span>{dependency?.config?.name || name}</span>{" — "}<span>{version}</span>{" — "}
                                        <span>{lf("Missing from this project")}</span>
                                    </li>;
                                })}</ul>
                            </div>}
                            <div className="project-backpack__actions">
                                <button className="project-backpack__button project-backpack__icon-button project-backpack__add" type="button" disabled={pending || !canImport}
                                    aria-label={lf("Add {0} to project", item.name)} aria-describedby={!canImport ? "project-backpack-import-reason" : undefined}
                                    title={lf("Add to project")} onClick={() => void addItem(entry)}>
                                    <i className="icon plus" aria-hidden="true" />
                                </button>
                            </div>
                        </>}
                    </li>;
                })}
            </ul>}
            </>}
        </div>
        {assetEdit && props.active && <BackpackAssetEditDialog item={assetEdit.item} context={assetEdit.context}
            onOpenError={message => { setErrorEntryKey(entryKey(assetEdit.entry)); setError(message); closeAssetEdit(); }}
            onClose={closeAssetEdit} onSave={async item => {
                if (!isCurrent() || !backpack.canEditBackpackAsset(props.headerId)) {
                    throw new Error(lf("Your project or account changed. Close the asset editor and try again."));
                }
                await backpack.saveBackpackAssetAsync(assetEdit.entry, item);
                if (!isCurrent()) return;
                setContents(readItems());
                closeAssetEdit();
            }} />}
        {modalOpen && editedItem && <Modal title={edit.kind === "rename" ? lf("Rename snippet") : lf("Delete snippet?")}
            className={`project-backpack__${edit.kind}-modal`}
            ariaDescribedBy={edit.kind === "delete" ? "project-backpack-delete-description" : undefined}
            onClose={cancelEdit} hideDismissButton={pending}
            actions={[
                { label: lf("Cancel"), className: "neutral", disabled: pending, onClick: cancelEdit },
                edit.kind === "rename"
                    ? { label: lf("Save"), disabled: pending, onClick: () => void renameItem() }
                    : { label: lf("Delete"), className: "red", disabled: pending, onClick: () => void deleteItem(editedItem) }
            ]}>
            {edit.kind === "rename" ? <form className="project-backpack__rename-form" aria-busy={pending}
                onSubmit={event => { event.preventDefault(); void renameItem(); }}>
                <label htmlFor="project-backpack-name">{lf("Snippet name")}</label>
                <input id="project-backpack-name" ref={nameInput} type="text" value={edit.name} disabled={pending}
                    maxLength={backpack.MAX_BACKPACK_NAME_LENGTH} aria-invalid={!!error}
                    aria-describedby={error ? "project-backpack-name-error" : undefined}
                    onChange={event => { setEdit({ ...edit, name: event.target.value }); setError(undefined); }} />
                {error && <p id="project-backpack-name-error" role="alert">{error}</p>}
            </form> : <div aria-busy={pending}>
                <p id="project-backpack-delete-description">{editedItem.source === "cloud"
                    ? lf("Delete {0} from your backpack on all devices?", editedItem.name)
                    : editedItem.local?.firstAttemptAt
                    ? lf("Delete the pending copy of {0} from this browser? Any copy already synced to your account will not be deleted.", editedItem.name)
                    : lf("Delete {0} from your backpack in this browser?", editedItem.name)}</p>
                {error && <p role="alert">{error}</p>}
            </div>}
        </Modal>}
    </>;
}