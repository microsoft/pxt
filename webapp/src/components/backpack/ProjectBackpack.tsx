import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import * as auth from "../../auth";
import * as backpack from "../../backpack";
import { createBackpackSearch } from "../../backpackSearch";
import { BackpackUserError } from "../../backpackErrors";
import { getMissingBlockSnippetDependencies } from "../../blockSnippet";
import * as data from "../../data";
import * as pkg from "../../package";
import { BackpackAssetEditDialog } from "./BackpackAssetEditDialog";
import { BackpackEntryCard } from "./BackpackEntryCard";
import { BackpackItemDialog, BackpackItemEdit } from "./BackpackItemDialog";
import { BackpackToolbar } from "./BackpackToolbar";
import { useBackpackDrag } from "./useBackpackDrag";
import { getBackpackUserId, useBackpackCollection } from "./useBackpackCollection";

export interface ProjectBackpackProps {
    headerId: string;
    active: boolean;
    tutorial?: boolean;
    openRequest?: backpack.BackpackOpenRequest;
    renderHeader: (title: string, actions?: React.ReactNode) => React.ReactNode;
    onSignIn: () => void;
    onModalOpenChange?: (open: boolean) => void;
}

interface BackpackContentsProps extends ProjectBackpackProps {
    userId?: string;
    assetsEnabled: boolean;
}

interface BackpackAssetEdit {
    entry: backpack.BackpackEntry;
    item: pxt.auth.BackpackItem;
    context: backpack.BackpackAssetEditorContext;
}

type BackpackDialog =
    | { type: "item"; edit: BackpackItemEdit }
    | { type: "asset"; asset: BackpackAssetEdit }
    | { type: "loading-asset"; entry: backpack.BackpackEntry };

interface BackpackFocusTarget {
    key?: string;
    action?: "rename" | "delete";
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

    return getBackpackUserId();
}

export function ProjectBackpack(props: ProjectBackpackProps): JSX.Element {
    const userId = useBackpackAccount();
    if (!backpack.isBackpackEnabled()) return null;

    const tutorial = props.tutorial || !!pkg.mainEditorPkg()?.header?.tutorial;
    const assetsEnabled = backpack.isBackpackAssetsEnabled();
    // Reset the panel's contents and pending operations when its account or project changes.
    return (
        <BackpackContents
            key={`${pxt.appTarget?.id}:${userId ? `user:${userId}` : "guest"}:${props.headerId}:${tutorial}:${assetsEnabled}`}
            {...props}
            tutorial={tutorial}
            userId={userId}
            assetsEnabled={assetsEnabled}
        />
    );
}

function BackpackContents(props: BackpackContentsProps): JSX.Element {
    const {
        headerId,
        active: panelActive,
        tutorial,
        assetsEnabled,
        userId,
        openRequest,
        renderHeader,
        onSignIn,
        onModalOpenChange
    } = props;

    const [kind, setKind] = React.useState<pxt.auth.BackpackKind>(
        assetsEnabled ? (tutorial ? "asset" : openRequest?.kind || "code") : "code"
    );
    const [query, setQuery] = React.useState("");
    const [dialog, setDialog] = React.useState<BackpackDialog>();

    const active = React.useRef(panelActive);
    active.current = panelActive;
    const body = React.useRef<HTMLDivElement>();
    const entryError = React.useRef<HTMLParagraphElement>();
    const searchInput = React.useRef<HTMLInputElement>();
    const kindButtons = React.useRef<HTMLElement[]>([]);
    const focusAfter = React.useRef<BackpackFocusTarget>();

    const onPageReturn = (): void => {
        // Keep focus inside the panel before the refresh removes the focused card.
        const ownsFocus = body.current?.contains(document.activeElement)
            || kindButtons.current.some(button => button === document.activeElement);
        if (active.current && ownsFocus) body.current?.focus();
    };

    const edit = dialog?.type === "item" ? dialog.edit : undefined;
    const assetEdit = dialog?.type === "asset" ? dialog.asset : undefined;
    const openingAssetKey = dialog?.type === "loading-asset" ? entryKey(dialog.entry) : undefined;
    const editedItem = edit?.entry;
    const itemDialogOpen = !!edit && (edit.kind === "delete" || !edit.entry.error);
    const modalOpen = panelActive && (!!assetEdit || itemDialogOpen);
    const keepPanelOpen = (modalOpen || !!openingAssetKey) && panelActive;
    const collection = useBackpackCollection({
        userId,
        active: panelActive,
        paused: keepPanelOpen,
        onRefresh: () => setDialog(current => current?.type === "item" ? undefined : current),
        onPageReturn
    });
    const {
        state: contents,
        ready,
        pending,
        loading,
        isCurrent,
        isBusy,
        runAsync,
        refreshAsync,
        reload,
        showError
    } = collection;
    const { entries: items, warning } = contents;
    const error = collection.error?.message;
    const errorEntryKey = collection.error?.entryKey;
    const codeUnavailable = tutorial && kind === "code";

    const searchItems = (entries: backpack.BackpackEntry[]) => createBackpackSearch(
        entries.filter(entry => entryKind(entry) === kind),
        name => Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name)
            ? pkg.mainPkg.deps[name]?.config?.name
            : undefined
    );
    const search = React.useMemo(() => searchItems(items), [items, kind]);
    const filteredItems = React.useMemo(() => search(ready ? query : ""), [search, query, ready]);
    const categoryCount = items.filter(entry => entryKind(entry) === kind).length;

    React.useEffect(() => {
        if (openRequest?.kind) {
            setKind(assetsEnabled ? tutorial ? "asset" : openRequest.kind : "code");
            setQuery("");
        }
    }, [openRequest]);

    React.useLayoutEffect(() => {
        onModalOpenChange?.(keepPanelOpen);
    }, [keepPanelOpen, onModalOpenChange]);

    React.useEffect(() => {
        return () => onModalOpenChange?.(false);
    }, [onModalOpenChange]);

    React.useEffect(() => {
        if (!panelActive) setDialog(undefined);
    }, [panelActive]);

    React.useEffect(() => {
        if (pending || !focusAfter.current) return;
        const target = focusAfter.current;
        focusAfter.current = undefined;
        if (!active.current || !isCurrent()) return;

        const entry = Array.from(body.current?.querySelectorAll<HTMLElement>("[data-backpack-key]") || [])
            .find(element => element.dataset.backpackKey === target.key);
        const button = entry?.querySelector<HTMLButtonElement>(
            target.action ? `.project-backpack-${target.action}` : "button:not(:disabled)"
        );
        (button || (query.trim() ? searchInput.current : body.current))?.focus();
    }, [pending, items, edit, assetEdit, query]);

    React.useEffect(() => {
        if (panelActive && !pending && !modalOpen && errorEntryKey && error) {
            entryError.current?.scrollIntoView({ block: "nearest" });
        }
    }, [panelActive, pending, modalOpen, errorEntryKey, error]);

    const cancelEdit = () => {
        if (isBusy()) return;

        focusAfter.current = { key: edit.key, action: edit.kind };
        setDialog(undefined);
        showError();
    };

    const beginEdit = (item: backpack.BackpackEntry, kind: "rename" | "delete"): void => {
        if (isBusy() || !isCurrent() || kind === "rename" && item.error) return;
        // Keep the panel open while focus moves into the dialog.
        onModalOpenChange?.(true);
        showError();
        setDialog({ type: "item", edit: { kind, key: entryKey(item), name: item.name, entry: item } });
    };

    const deleteItem = (item: backpack.BackpackEntry) => runAsync(async () => {
        const index = filteredItems.findIndex(entry => entryKey(entry) === entryKey(item));
        await backpack.deleteBackpackEntryAsync(item);
        if (!isCurrent()) return;

        const remaining = reload();
        const visible = searchItems(remaining.entries)(query);
        const next = visible[index] || visible[index - 1];
        focusAfter.current = { key: next && entryKey(next) };
        setDialog(undefined);
    });

    const renameItem = () => runAsync(async () => {
        await backpack.renameBackpackItemAsync(editedItem.id, edit.name, editedItem);
        if (!isCurrent()) return;
        focusAfter.current = { key: edit.key, action: "rename" };
        reload();
        setDialog(undefined);
    });

    const addItem = (entry: backpack.BackpackEntry, position?: backpack.BackpackImportPosition) => runAsync(async () => {
        await backpack.importBackpackEntryAsync(entry, headerId, position);
    });

    const editAsset = (entry: backpack.BackpackEntry) => runAsync(async () => {
        // Loading disables the Edit button. Keep the panel open until the dialog appears.
        onModalOpenChange?.(true);
        setDialog({ type: "loading-asset", entry });

        try {
            const item = await backpack.loadBackpackAssetAsync(entry);
            if (!isCurrent() || !active.current) return;

            const context = await backpack.getBackpackAssetEditorContextAsync(headerId);
            if (!isCurrent() || !active.current) return;
            setDialog({ type: "asset", asset: { entry, item, context } });
        } catch (reason) {
            if (isCurrent()) focusAfter.current = { key: entryKey(entry), action: "rename" };
            throw reason;
        } finally {
            if (isCurrent()) {
                setDialog(current => current?.type === "loading-asset" ? undefined : current);
            }
        }
    }, entryKey(entry));

    const closeAssetEdit = (): void => {
        focusAfter.current = { key: entryKey(assetEdit.entry), action: "rename" };
        setDialog(undefined);
    };

    const canImport = !codeUnavailable && backpack.canImportBackpack(headerId, kind);
    const canEditAsset = backpack.canEditBackpackAsset(headerId);
    const { startDrag, endDrag } = useBackpackDrag({
        headerId,
        active: panelActive,
        kind,
        canImport,
        modalOpen,
        isBusy,
        isCurrent,
        onImport: addItem
    });
    const header = pkg.mainEditorPkg()?.header;
    const importReason = !header || header.id !== headerId || pkg.mainPkg.getPreferredEditor() === pxt.BLOCKS_PROJECT_NAME
        ? lf("Open an editable Blocks project to add items from your backpack.")
        : lf("Switch to Blocks to add snippets");
    const message = loading ? lf("Loading backpack…") : "";
    const displayedError = error || (!ready && !pending ? warning : undefined);
    const clearSearch = (): void => {
        setQuery("");
        searchInput.current?.focus();
    };

    const changeKind = (kind: pxt.auth.BackpackKind): void => {
        setKind(kind);
        setQuery("");
    };

    const retryRefresh = (): void => {
        focusAfter.current = {};
        void refreshAsync();
    };

    const changeName = (name: string): void => {
        setDialog({ type: "item", edit: { ...edit, name } });
        showError();
    };

    const onAssetOpenError = (message: string): void => {
        showError(message, entryKey(assetEdit.entry));
        closeAssetEdit();
    };

    const saveAsset = async (item: pxt.auth.BackpackItem): Promise<void> => {
        if (!isCurrent() || !backpack.canEditBackpackAsset(headerId)) {
            throw new BackpackUserError(lf("Your project or account changed. Close the asset editor and try again."));
        }

        await backpack.saveBackpackAssetAsync(assetEdit.entry, item);
        if (!isCurrent()) return;

        reload();
        closeAssetEdit();
    };

    const renderEntry = (entry: backpack.BackpackEntry): JSX.Element => {
        const item = entry.error ? undefined : entry.summary || entry.item;
        const missingDependencies = getMissingBlockSnippetDependencies(item?.dependencies, pkg.mainPkg)
            .map(([name, version]) => {
                const dependency = Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name)
                    ? pkg.mainPkg.deps[name]
                    : undefined;
                return { name, version, displayName: dependency?.config?.name || name };
            });

        return (
            <BackpackEntryCard
                key={entryKey(entry)}
                entry={entry}
                headerId={headerId}
                active={panelActive}
                signedIn={!!userId}
                pending={pending}
                canImport={canImport}
                canEditAsset={canEditAsset}
                openingAsset={openingAssetKey === entryKey(entry)}
                error={!modalOpen && errorEntryKey === entryKey(entry) ? error : undefined}
                errorRef={entryError}
                missingDependencies={missingDependencies}
                onEdit={() => item.kind === "asset" ? void editAsset(entry) : beginEdit(entry, "rename")}
                onDelete={() => beginEdit(entry, "delete")}
                onRetrySync={() => void runAsync(() => backpack.retryBackpackEntryAsync(entry))}
                onAdd={() => void addItem(entry)}
                onDragStart={canImport && !pending && !modalOpen ? event => startDrag(event, entry) : undefined}
                onDragEnd={endDrag}
            />
        );
    };

    return (
        <>
            <BackpackToolbar
                assetsEnabled={assetsEnabled}
                codeUnavailable={codeUnavailable}
                kind={kind}
                query={query}
                pending={pending}
                searchDisabled={ready && !categoryCount}
                searchInputRef={searchInput}
                kindButtonsRef={kindButtons}
                renderHeader={renderHeader}
                onKindChange={changeKind}
                onQueryChange={setQuery}
                onClearSearch={clearSearch}
            />
            <div
                ref={body}
                id="project-backpack-items"
                className="project-backpack-body"
                tabIndex={-1}
                aria-busy={pending}
                role={assetsEnabled ? "tabpanel" : "region"}
                aria-label={assetsEnabled ? undefined : lf("Backpack snippets")}
                aria-labelledby={assetsEnabled ? `project-backpack-tab-${kind}` : undefined}
            >
                {codeUnavailable ? (
                    <p>{assetsEnabled
                        ? lf("Code snippets aren't available during tutorials. Use the Assets tab to add your own assets.")
                        : lf("Code snippets aren't available during tutorials.")}</p>
                ) : (
                    <>
                        {!userId && auth.hasIdentity() && (
                            <Button
                                className="project-backpack-button project-backpack-sign-in"
                                type="button"
                                onClick={onSignIn}
                                label={lf("Sign in to save your backpack across browsers.")}
                                title={lf("Sign in to save your backpack across browsers.")}
                            />
                        )}
                        <div role="status">
                            {message && <p>{message}</p>}
                            {warning && warning !== displayedError && <p>{warning}</p>}
                            {!ready && !pending && !!items.length && (
                                <p>{lf("Some snippets could not be loaded. Retry to search the complete backpack.")}</p>
                            )}
                            {ready && !!categoryCount && !!query.trim() && (
                                <p>{filteredItems.length
                                    ? lf("{0} of {1} snippets", filteredItems.length, categoryCount)
                                    : lf("No matching snippets.")}</p>
                            )}
                        </div>
                        {displayedError && !modalOpen && !errorEntryKey && (
                            <>
                                <p role="alert">{displayedError}</p>
                                {!ready && (
                                    <Button
                                        className="project-backpack-button project-backpack-retry"
                                        type="button"
                                        hardDisabled={pending}
                                        label={lf("Retry")}
                                        title={lf("Retry")}
                                        onClick={retryRefresh}
                                    />
                                )}
                            </>
                        )}
                        {!canImport && <p id="project-backpack-import-reason">{importReason}</p>}
                        {ready && !categoryCount && (
                            <div className="project-backpack-empty">
                                <p>{!items.length
                                    ? lf("Your backpack is empty.")
                                    : kind === "asset" ? lf("No saved assets.") : lf("No saved code.")}</p>
                                <p>{kind === "asset"
                                    ? lf("Right-click or drag an image, animation, tilemap or music asset block into Backpack to save it here.")
                                    : lf("Right-click or hold a block container and choose Add to Backpack, or drag blocks over the Backpack bubble, then drop them into the backpack.")}</p>
                            </div>
                        )}
                        {!!filteredItems.length && (
                            <ul
                                className="project-backpack-list"
                                aria-label={lf("Backpack snippets")}
                            >
                                {filteredItems.map(renderEntry)}
                            </ul>
                        )}
                    </>
                )}
            </div>
            {assetEdit && panelActive && (
                <BackpackAssetEditDialog
                    item={assetEdit.item}
                    context={assetEdit.context}
                    onOpenError={onAssetOpenError}
                    onClose={closeAssetEdit}
                    onSave={saveAsset}
                />
            )}
            {modalOpen && editedItem && (
                <BackpackItemDialog
                    edit={edit}
                    pending={pending}
                    error={error}
                    onCancel={cancelEdit}
                    onRename={() => void renameItem()}
                    onDelete={() => void deleteItem(editedItem)}
                    onNameChange={changeName}
                />
            )}
        </>
    );
}