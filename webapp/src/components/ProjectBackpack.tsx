import * as React from "react";
import { Button } from "../../../react-common/components/controls/Button";
import { Input } from "../../../react-common/components/controls/Input";
import { TabList } from "../../../react-common/components/controls/TabList";
import * as auth from "../auth";
import * as backpack from "../backpack";
import { createBackpackSearch } from "../backpackSearch";
import { getMissingBlockSnippetDependencies } from "../blockSnippet";
import * as data from "../data";
import * as pkg from "../package";
import { BackpackAssetEditDialog } from "./BackpackAssetEditDialog";
import { BackpackEntryCard } from "./BackpackEntryCard";
import { BackpackItemDialog, BackpackItemEdit } from "./BackpackItemDialog";

export interface ProjectBackpackProps {
    headerId: string;
    active: boolean;
    tutorial?: boolean;
    openRequest?: backpack.BackpackOpenRequest;
    renderHeader: (title: string, actions?: React.ReactNode) => React.ReactNode;
    onSignIn: () => void;
    onModalOpenChange?: (open: boolean) => void;
}

function currentUserId(): string | undefined {
    return auth.hasIdentity() && auth.loggedIn() ? auth.userProfile()?.id : undefined;
}

function entryKey(entry: backpack.BackpackEntry): string {
    return backpack.backpackEntryKey(entry);
}

function entryKind(entry: backpack.BackpackEntry): pxt.auth.BackpackKind {
    return entry.summary?.kind || entry.item?.kind || "code";
}

function useBackpackAccount(): string | undefined {
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    React.useLayoutEffect(() => {
        const subscriber: data.DataSubscriber = {
            subscriptions: [],
            onDataChanged: () => {
                backpack.notifyBackpackEditorChanged();
                update();
            }
        };
        data.subscribe(subscriber, auth.USER_PROFILE);
        data.subscribe(subscriber, auth.LOGGED_IN);
        update();
        return () => data.unsubscribe(subscriber);
    }, []);
    return currentUserId();
}

export function ProjectBackpack(props: ProjectBackpackProps): JSX.Element {
    const userId = useBackpackAccount();
    if (!backpack.isBackpackEnabled()) return null;
    const tutorial = props.tutorial || !!pkg.mainEditorPkg()?.header?.tutorial;
    const assetsEnabled = backpack.isBackpackAssetsEnabled();
    // Guest/account transitions get fresh contents, including pending/error state.
    return <BackpackContents key={`${pxt.appTarget?.id}:${userId ? `user:${userId}` : "guest"}:${props.headerId}:${tutorial}:${assetsEnabled}`}
        {...props} tutorial={tutorial} userId={userId} assetsEnabled={assetsEnabled} />;
}

function BackpackContents(props: ProjectBackpackProps & { userId?: string; assetsEnabled: boolean }): JSX.Element {
    const [contents, setContents] = React.useState<backpack.BackpackState>({ entries: [] });
    const { entries: items, warning } = contents;
    const [kind, setKind] = React.useState<pxt.auth.BackpackKind>(props.assetsEnabled
        ? props.tutorial ? "asset" : props.openRequest?.kind || "code" : "code");
    const codeUnavailable = props.tutorial && kind === "code";
    const [query, setQuery] = React.useState("");
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const [errorEntryKey, setErrorEntryKey] = React.useState<string>();
    const [openingAssetKey, setOpeningAssetKey] = React.useState<string>();
    const [edit, setEdit] = React.useState<BackpackItemEdit>();
    const [assetEdit, setAssetEdit] = React.useState<{ entry: backpack.BackpackEntry; item: pxt.auth.BackpackItem;
        context: backpack.BackpackAssetEditorContext }>();
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    const alive = React.useRef(true);
    const active = React.useRef(props.active);
    active.current = props.active;
    const busy = React.useRef(false);
    const dragged = React.useRef<backpack.BackpackEntry>();
    const loaded = React.useRef(false);
    // Each account/project mount must acknowledge metadata before showing cards.
    const fullRefresh = React.useRef(true);
    const refreshQueued = React.useRef(true);
    const refreshGeneration = React.useRef(0);
    const body = React.useRef<HTMLDivElement>();
    const entryError = React.useRef<HTMLParagraphElement>();
    const searchInput = React.useRef<HTMLInputElement>();
    const nameInput = React.useRef<HTMLInputElement>();
    const kindButtons = React.useRef<HTMLElement[]>([]);
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
            try {
                setContents(readItems());
            } catch (reason) {
                setContents({ entries: [] });
                loaded.current = false;
                setReady(false);
                reportError(reason);
            }
        });
        return () => { alive.current = false; unsubscribe(); };
    }, []);

    const run = async (action: () => Promise<void>, errorKey?: string): Promise<void> => {
        if (busy.current || !isCurrent()) return;
        busy.current = true;
        setPending(true);
        setError(undefined);
        setErrorEntryKey(undefined);
        try {
            await action();
        } catch (reason) {
            if (isCurrent()) {
                setErrorEntryKey(errorKey);
                reportError(reason);
            }
        } finally {
            if (isCurrent()) {
                busy.current = false;
                setPending(false);
            }
        }
    };

    const refresh = () => run(async () => {
        refreshQueued.current = false;
        const generation = refreshGeneration.current;
        const force = fullRefresh.current;
        const previous = force ? { entries: [] } : readItems();
        loaded.current = !!previous.complete || !!previous.entries.length;
        setReady(!!previous.complete);
        setContents(previous);
        setEdit(undefined);
        try { await backpack.refreshBackpackAsync(); }
        catch (reason) {
            if (generation !== refreshGeneration.current) return;
            if (isCurrent()) {
                const state = readItems();
                // Failed revalidation may retain this session's list, but never
                // revive unacknowledged contents after a focus/project change.
                setContents(!force && state.complete === false ? state : { entries: [] });
                setReady(false);
                loaded.current = !force;
            }
            throw reason;
        }
        if (!isCurrent() || generation !== refreshGeneration.current) return;
        setContents(readItems());
        loaded.current = true;
        fullRefresh.current = false;
        setReady(true);
    });

    React.useLayoutEffect(() => { if (props.active) refreshQueued.current = true; }, [props.active]);
    React.useEffect(() => {
        let away = document.hidden;
        let blurTimer: number;
        let focusedFrame: HTMLIFrameElement;
        let frameWindow: Window;
        const detachFrameWindow = (): void => {
            try {
                frameWindow?.removeEventListener("blur", onBlur);
                frameWindow?.removeEventListener("focus", onReturn);
            } catch { /* A frame may have navigated to another origin. */ }
            frameWindow = undefined;
        };
        const attachFrameWindow = (): void => {
            detachFrameWindow();
            try {
                frameWindow = focusedFrame?.contentWindow;
                frameWindow?.addEventListener("blur", onBlur);
                frameWindow?.addEventListener("focus", onReturn);
            } catch { frameWindow = undefined; } // Cross-origin frames still use visibilitychange.
        };
        const onBlur = (): void => {
            window.clearTimeout(blurTimer);
            blurTimer = window.setTimeout(() => {
                // Moving focus into the simulator/docs iframe is not leaving the page.
                if (!document.hasFocus()) away = true;
                const frame = document.activeElement instanceof HTMLIFrameElement ? document.activeElement : undefined;
                if (frame !== focusedFrame) {
                    focusedFrame?.removeEventListener("load", attachFrameWindow);
                    focusedFrame = frame;
                    focusedFrame?.addEventListener("load", attachFrameWindow);
                    attachFrameWindow();
                }
            }, 0);
        };
        const onReturn = (): void => {
            if (document.hidden) { away = true; return; }
            if (!away || !isCurrent()) return;
            away = false; // Coalesce visibilitychange and window focus on the same return.
            fullRefresh.current = true;
            refreshQueued.current = true;
            refreshGeneration.current++;
            loaded.current = false;
            // Removing a focused card must not dismiss the owning disclosure.
            if (active.current && (body.current?.contains(document.activeElement)
                || kindButtons.current.some(button => button === document.activeElement))) body.current?.focus();
            setContents({ entries: [] });
            setReady(false);
        };
        document.addEventListener("visibilitychange", onReturn);
        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onReturn);
        onBlur(); // The panel may mount while a pinned simulator already has focus.
        return () => {
            window.clearTimeout(blurTimer);
            focusedFrame?.removeEventListener("load", attachFrameWindow);
            detachFrameWindow();
            document.removeEventListener("visibilitychange", onReturn);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onReturn);
        };
    }, []);
    React.useEffect(() => {
        if (props.openRequest?.kind) {
            setKind(props.assetsEnabled ? props.tutorial ? "asset" : props.openRequest.kind : "code");
            setQuery("");
        }
    }, [props.openRequest]);

    const editedItem = edit?.entry;
    const modalOpen = (!!assetEdit || !!editedItem && (edit.kind === "delete" || !editedItem.error)) && props.active;
    const keepPanelOpen = (modalOpen || !!openingAssetKey) && props.active;
    React.useLayoutEffect(() => {
        // Recheck after pending work/dialogs finish; a return during a request
        // needs a newer request, not that request's potentially stale response.
        if (props.active && !document.hidden && !busy.current && !keepPanelOpen && refreshQueued.current) void refresh();
    });
    React.useEffect(() => {
        props.onModalOpenChange?.(keepPanelOpen);
        return () => props.onModalOpenChange?.(false);
    }, [keepPanelOpen, props.onModalOpenChange]);
    React.useEffect(() => {
        if (!props.active) {
            setEdit(undefined);
            setAssetEdit(undefined);
            setOpeningAssetKey(undefined);
        }
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
    const importReason = !header || header.id !== props.headerId || pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME
        ? lf("Open an editable Blocks project to add items from your backpack.")
        : lf("Switch to Blocks to add snippets");
    const message = !loaded.current && pending && props.active ? lf("Loading backpack…") : "";
    const displayedError = error || (!ready && !pending ? warning : undefined);
    const clearSearch = (): void => {
        setQuery("");
        searchInput.current?.focus();
    };

    return <>
        {props.renderHeader(lf("Backpack"), props.assetsEnabled && <TabList
            className="project-backpack__tabs"
            ariaLabel={lf("Backpack contents")}
            orientation="horizontal"
            nativeBehavior
            selectedId={`project-backpack-tab-${kind}`}
            onTabSelected={id => {
                setKind(id === "project-backpack-tab-asset" ? "asset" : "code");
                setQuery("");
            }}
            tabs={(["code", "asset"] as const).map((value, index) => ({
                id: `project-backpack-tab-${value}`,
                buttonRef: element => { kindButtons.current[index] = element; },
                className: "project-backpack__button",
                type: "button",
                ariaControls: "project-backpack-items",
                hardDisabled: pending,
                label: value === "code" ? lf("Code") : lf("Assets"),
                title: value === "code" ? lf("Code") : lf("Assets")
            }))}
        />)}
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
            {!!query && <Button
                className="project-backpack__button project-backpack__icon-button"
                type="button"
                nativeBehavior
                onClick={clearSearch}
                ariaLabel={lf("Clear backpack search")}
                title={lf("Clear backpack search")}
                leftIcon="icon remove"
            />}
        </div>}
        <div ref={body} id="project-backpack-items" className="project-backpack__body" tabIndex={-1} aria-busy={pending}
            role={props.assetsEnabled ? "tabpanel" : "region"} aria-label={props.assetsEnabled ? undefined : lf("Backpack snippets")}
            aria-labelledby={props.assetsEnabled ? `project-backpack-tab-${kind}` : undefined}>
            {codeUnavailable ? <p>{props.assetsEnabled
                ? lf("Code snippets aren't available during tutorials. Use the Assets tab to add your own assets.")
                : lf("Code snippets aren't available during tutorials.")}</p> : <>
            {!props.userId && auth.hasIdentity() && <Button
                className="project-backpack__button project-backpack__sign-in"
                type="button"
                nativeBehavior
                onClick={props.onSignIn}
                label={lf("Sign in to save your backpack across browsers.")}
                title={lf("Sign in to save your backpack across browsers.")}
            />}
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
                {!ready && <Button
                    className="project-backpack__button project-backpack__retry"
                    type="button"
                    nativeBehavior
                    hardDisabled={pending}
                    label={lf("Retry")}
                    title={lf("Retry")}
                    onClick={() => {
                        focusAfter.current = {};
                        void refresh();
                    }}
                />}
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
                    const missingDependencies = getMissingBlockSnippetDependencies(item?.dependencies, pkg.mainPkg).map(([name, version]) => {
                        const dependency = Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name] : undefined;
                        return { name, version, displayName: dependency?.config?.name || name };
                    });
                    return <BackpackEntryCard
                        key={entryKey(entry)}
                        entry={entry}
                        headerId={props.headerId}
                        active={props.active}
                        signedIn={!!props.userId}
                        pending={pending}
                        canImport={canImport}
                        canEditAsset={canEditAsset}
                        openingAsset={openingAssetKey === entryKey(entry)}
                        error={!modalOpen && errorEntryKey === entryKey(entry) ? error : undefined}
                        errorRef={entryError}
                        missingDependencies={missingDependencies}
                        onEdit={() => item.kind === "asset" ? void editAsset(entry) : beginEdit(entry, "rename")}
                        onDelete={() => beginEdit(entry, "delete")}
                        onRetrySync={() => void run(() => backpack.retryBackpackEntryAsync(entry))}
                        onAdd={() => void addItem(entry)}
                        onDragStart={canImport && !pending && !modalOpen ? event => startDrag(event, entry) : undefined}
                        onDragEnd={() => { dragged.current = undefined; }}
                    />;
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
        {modalOpen && editedItem && <BackpackItemDialog
            edit={edit}
            pending={pending}
            error={error}
            nameInputRef={nameInput}
            onCancel={cancelEdit}
            onRename={() => void renameItem()}
            onDelete={() => void deleteItem(editedItem)}
            onNameChange={name => {
                setEdit({ ...edit, name });
                setError(undefined);
            }}
        />}
    </>;
}