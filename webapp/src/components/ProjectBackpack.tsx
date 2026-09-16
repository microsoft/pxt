import * as React from "react";
import { Input } from "../../../react-common/components/controls/Input";
import { Modal } from "../../../react-common/components/controls/Modal";
import * as auth from "../auth";
import * as backpack from "../backpack";
import { createBackpackSearch } from "../backpackSearch";
import * as data from "../data";
import * as pkg from "../package";

export interface ProjectBackpackProps {
    headerId: string;
    active: boolean;
    renderHeader: (title: string, actions?: React.ReactNode) => React.ReactNode;
    onSignIn: () => void;
    onModalOpenChange?: (open: boolean) => void;
}

function currentUserId(): string {
    return auth.loggedIn() ? auth.userProfile()?.id : undefined;
}

function entryKey(entry: backpack.BackpackEntry): string {
    return `${entry.source}:${entry.id}`;
}

export function ProjectBackpack(props: ProjectBackpackProps): JSX.Element {
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    React.useLayoutEffect(() => {
        const subscriber: data.DataSubscriber = { subscriptions: [], onDataChanged: () => update() };
        data.subscribe(subscriber, auth.USER_PROFILE);
        data.subscribe(subscriber, auth.LOGGED_IN);
        update();
        return () => data.unsubscribe(subscriber);
    }, []);
    const userId = currentUserId();
    // Guest/account transitions get fresh contents, including pending/error state.
    return <BackpackContents key={userId ? `user:${userId}` : "guest"} {...props} userId={userId} />;
}

function BackpackContents(props: ProjectBackpackProps & { userId?: string }): JSX.Element {
    const [contents, setContents] = React.useState<backpack.BackpackState>({ entries: [] });
    const { entries: items, warning } = contents;
    const [query, setQuery] = React.useState("");
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const [edit, setEdit] = React.useState<{ kind: "rename" | "delete"; key: string; name: string }>();
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    const alive = React.useRef(true);
    const active = React.useRef(props.active);
    active.current = props.active;
    const busy = React.useRef(false);
    const loaded = React.useRef(false);
    const body = React.useRef<HTMLDivElement>();
    const searchInput = React.useRef<HTMLInputElement>();
    const nameInput = React.useRef<HTMLInputElement>();
    const focusAfter = React.useRef<{ key?: string; action?: "rename" | "delete" }>();
    const isCurrent = () => alive.current && currentUserId() === props.userId;

    const searchItems = (entries: backpack.BackpackEntry[]) => createBackpackSearch(entries,
        name => Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name]?.config?.name : undefined);
    const search = React.useMemo(() => searchItems(items), [items]);
    const filteredItems = React.useMemo(() => search(query), [search, query]);

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

    const run = async (action: () => Promise<void>): Promise<void> => {
        if (busy.current || !isCurrent()) return;
        busy.current = true;
        setPending(true);
        setError(undefined);
        try { await action(); }
        catch (reason) { if (isCurrent()) reportError(reason); }
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
        await backpack.refreshBackpackAsync();
        if (!isCurrent()) return;
        setContents(readItems());
        loaded.current = true;
        setReady(true);
    });

    React.useLayoutEffect(() => { if (props.active) void refresh(); }, [props.active]);

    const editedItem = items.find(item => entryKey(item) === edit?.key);
    const modalOpen = !!editedItem && (edit.kind === "delete" || !!editedItem.item) && props.active;
    React.useEffect(() => {
        props.onModalOpenChange?.(modalOpen);
        return () => props.onModalOpenChange?.(false);
    }, [modalOpen, props.onModalOpenChange]);
    React.useEffect(() => {
        if (!props.active) setEdit(undefined);
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
    }, [pending, items, edit, query]);

    const cancelEdit = () => {
        if (busy.current) return;
        focusAfter.current = { key: edit.key, action: edit.kind };
        setEdit(undefined);
        setError(undefined);
    };
    const beginEdit = (item: backpack.BackpackEntry, kind: "rename" | "delete"): void => {
        if (busy.current || !isCurrent() || kind === "rename" && !item.item) return;
        // The shared modal takes focus during its mount, before effects run.
        // Keep the owning panel open while focus moves into the portal.
        props.onModalOpenChange?.(true);
        setError(undefined);
        setEdit({ kind, key: entryKey(item), name: item.name });
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
        await backpack.renameBackpackItemAsync(editedItem.id, edit.name);
        if (!isCurrent()) return;
        focusAfter.current = { key: edit.key, action: "rename" };
        setContents(readItems());
        setEdit(undefined);
    });
    const addItem = (item: pxt.auth.BackpackItem) => run(async () => {
        await backpack.importBackpackItemAsync(item, props.headerId);
    });

    const canImport = backpack.canImportBackpack(props.headerId);
    const header = pkg.mainEditorPkg()?.header;
    const importReason = !header || header.id !== props.headerId || header.tutorial || pxt.shell.isReadOnly()
        || pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME
        ? lf("Open an editable Blocks project outside a tutorial to add snippets from your backpack.")
        : lf("Switch to Blocks to add snippets");
    const message = !ready && !error && props.active ? lf("Loading backpack…") : "";
    const clearSearch = (): void => {
        setQuery("");
        searchInput.current?.focus();
    };

    return <>
        {props.renderHeader(lf("Backpack"))}
        <div className="project-backpack__search" role="search" aria-label={lf("Backpack")}
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
                disabled={!ready || pending} />
            {!!query && <button className="project-backpack__button project-backpack__icon-button"
                type="button" disabled={!ready || pending} onClick={clearSearch}
                aria-label={lf("Clear backpack search")} title={lf("Clear backpack search")}>
                <i className="icon remove" aria-hidden="true" />
            </button>}
        </div>
        <div ref={body} className="project-backpack__body" tabIndex={-1} aria-busy={pending}>
            {!props.userId && auth.hasIdentity() && <button className="project-backpack__button project-backpack__sign-in"
                type="button" onClick={props.onSignIn}>{lf("Sign in to save your backpack across browsers.")}</button>}
            <div role="status">
                {message && <p>{message}</p>}
                {ready && warning && <p>{warning}</p>}
                {ready && !!items.length && !!query.trim() && <p>{filteredItems.length
                    ? lf("{0} of {1} snippets", filteredItems.length, items.length)
                    : lf("No matching snippets.")}</p>}
            </div>
            {error && !modalOpen && <>
                <p role="alert">{error}</p>
                {!ready && <button className="project-backpack__button project-backpack__retry" type="button" disabled={pending}
                    onClick={() => { focusAfter.current = {}; void refresh(); }}>{lf("Retry")}</button>}
            </>}
            {!canImport && <p id="project-backpack-import-reason">{importReason}</p>}
            {ready && !items.length && <div className="project-backpack__empty">
                <p>{lf("Your backpack is empty.")}</p>
                <p>{lf("Right-click or hold a block container and choose Add to Backpack, or drag blocks over the Backpack bubble, then drop them into the backpack.")}</p>
            </div>}
            {ready && !!filteredItems.length && <ul className="project-backpack__list" aria-label={lf("Backpack snippets")}>
                {filteredItems.map(entry => {
                    const item = entry.item;
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
                                    type="button" disabled={pending} title={lf("Rename {0}", entry.name)}
                                    aria-label={lf("Rename {0}", entry.name)} aria-haspopup="dialog"
                                    onClick={() => beginEdit(entry, "rename")}>
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
                        {entry.error && <p className="project-backpack__invalid">{entry.error}</p>}
                        {!!props.userId && entry.source === "local" && <p>{lf("Saved in this browser only.")}</p>}
                        {item && <>
                            {item.previewUri && <img className="project-backpack__preview" src={item.previewPixelDensity ? undefined : item.previewUri}
                                srcSet={item.previewPixelDensity ? `${item.previewUri} ${item.previewPixelDensity}x` : undefined}
                                alt={lf("Blocks in {0}", item.name)} />}
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
                                <button className="project-backpack__button project-backpack__add" type="button" disabled={pending || !canImport}
                                    aria-label={lf("Add {0} to project", item.name)} aria-describedby={!canImport ? "project-backpack-import-reason" : undefined}
                                    onClick={() => void addItem(item)}>{lf("Add to project")}</button>
                            </div>
                        </>}
                    </li>;
                })}
            </ul>}
        </div>
        {modalOpen && <Modal title={edit.kind === "rename" ? lf("Rename snippet") : lf("Delete snippet?")}
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
                    : lf("Delete {0} from your backpack in this browser?", editedItem.name)}</p>
                {error && <p role="alert">{error}</p>}
            </div>}
        </Modal>}
    </>;
}