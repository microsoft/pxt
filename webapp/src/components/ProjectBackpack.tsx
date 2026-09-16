import * as React from "react";
import { Modal } from "../../../react-common/components/controls/Modal";
import * as auth from "../auth";
import * as backpack from "../backpack";
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
    const [items, setItems] = React.useState<pxt.auth.BackpackItem[]>([]);
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const [confirmId, setConfirmId] = React.useState<string>();
    const [, update] = React.useReducer((value: number) => value + 1, 0);
    const alive = React.useRef(true);
    const active = React.useRef(props.active);
    active.current = props.active;
    const busy = React.useRef(false);
    const loaded = React.useRef(false);
    const body = React.useRef<HTMLDivElement>();
    const focusAfter = React.useRef<{ id?: string; cancel?: boolean }>();
    const isCurrent = () => alive.current && currentUserId() === props.userId;

    const readItems = (): pxt.auth.BackpackItem[] => backpack.getBackpackItems().map(backpack.validateBackpackItem);
    const reportError = (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : lf("Could not update your backpack. Please try again."));
    };

    React.useEffect(() => {
        alive.current = true;
        const unsubscribe = backpack.subscribeBackpack(() => {
            if (!isCurrent()) return;
            update(); // Also observes editor eligibility and installed extensions.
            if (!loaded.current) return;
            try { setItems(readItems()); }
            catch (reason) { setItems([]); loaded.current = false; setReady(false); reportError(reason); }
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
        setItems([]);
        setConfirmId(undefined);
        await backpack.refreshBackpackAsync();
        if (!isCurrent()) return;
        setItems(readItems());
        loaded.current = true;
        setReady(true);
    });

    React.useLayoutEffect(() => { if (props.active) void refresh(); }, [props.active]);

    const confirmedItem = items.find(item => item.id === confirmId);
    const modalOpen = !!confirmedItem && props.active;
    React.useEffect(() => {
        props.onModalOpenChange?.(modalOpen);
        return () => props.onModalOpenChange?.(false);
    }, [modalOpen, props.onModalOpenChange]);
    React.useEffect(() => {
        if (!props.active) setConfirmId(undefined);
    }, [props.active]);
    React.useEffect(() => {
        if (pending || !focusAfter.current) return;
        const target = focusAfter.current;
        focusAfter.current = undefined;
        if (!active.current || !isCurrent()) return;
        const entry = Array.from(body.current?.querySelectorAll<HTMLElement>("[data-backpack-id]") || [])
            .find(element => element.dataset.backpackId === target.id);
        const button = entry?.querySelector<HTMLButtonElement>(target.cancel
            ? ".project-backpack__delete" : "button:not(:disabled)");
        (button || body.current)?.focus();
    }, [pending, items, confirmId]);

    const cancelDelete = () => {
        if (busy.current) return;
        focusAfter.current = { id: confirmId, cancel: true };
        setConfirmId(undefined);
        setError(undefined);
    };
    const confirmDelete = (item: pxt.auth.BackpackItem): void => {
        if (busy.current || !isCurrent()) return;
        // The shared modal takes focus during its mount, before effects run.
        // Keep the owning panel open while focus moves into the portal.
        props.onModalOpenChange?.(true);
        setError(undefined);
        setConfirmId(item.id);
    };
    const deleteItem = (item: pxt.auth.BackpackItem) => run(async () => {
        const index = items.findIndex(entry => entry.id === item.id);
        await backpack.deleteBackpackItemAsync(item.id);
        if (!isCurrent()) return;
        const remaining = readItems();
        focusAfter.current = { id: (remaining[index] || remaining[index - 1])?.id };
        setItems(remaining);
        setConfirmId(undefined);
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

    return <>
        {props.renderHeader(lf("Backpack"))}
        <div ref={body} className="project-backpack__body" tabIndex={-1} aria-busy={pending}>
            {!props.userId && auth.hasIdentity() && <button className="project-backpack__button project-backpack__sign-in"
                type="button" onClick={props.onSignIn}>{lf("Sign in to save your backpack across browsers.")}</button>}
            <div role="status">{message && <p>{message}</p>}</div>
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
            {ready && !!items.length && <ul className="project-backpack__list" aria-label={lf("Backpack snippets")}>
                {items.map(item => {
                    const missingDependencies = Object.entries(item.dependencies).filter(([name, version]) => {
                        const dependency = Object.prototype.hasOwnProperty.call(pkg.mainPkg.deps, name) ? pkg.mainPkg.deps[name] : undefined;
                        const installed = dependency && (version === "*" || dependency.verProtocol() === "github"
                            && version.startsWith("github:") && dependency.version().split("#")[0].toLowerCase() === version.split("#")[0].toLowerCase()
                            || dependency.version() === version);
                        return !installed;
                    });
                    return <li key={item.id} data-backpack-id={item.id} className="project-backpack__item">
                        <h3 className="project-backpack__name">{item.name}</h3>
                        {item.previewUri && <img className="project-backpack__preview" src={item.previewUri} alt={lf("Blocks in {0}", item.name)} />}
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
                            <button className="project-backpack__button" type="button" disabled={pending || !canImport}
                                aria-label={lf("Add {0} to project", item.name)} aria-describedby={!canImport ? "project-backpack-import-reason" : undefined}
                                onClick={() => void addItem(item)}>{lf("Add to project")}</button>
                            <button className="project-backpack__button project-backpack__delete" type="button" disabled={pending}
                                aria-label={lf("Delete {0}", item.name)} aria-haspopup="dialog"
                                onClick={() => confirmDelete(item)}>{lf("Delete")}</button>
                        </div>
                    </li>;
                })}
            </ul>}
        </div>
        {modalOpen && <Modal title={lf("Delete snippet?")} className="project-backpack__delete-modal"
            ariaDescribedBy="project-backpack-delete-description" onClose={cancelDelete} hideDismissButton={pending}
            actions={[
                { label: lf("Cancel"), className: "neutral", disabled: pending, onClick: cancelDelete },
                { label: lf("Delete"), className: "red", disabled: pending, onClick: () => void deleteItem(confirmedItem) }
            ]}>
            <div aria-busy={pending}>
                <p id="project-backpack-delete-description">{props.userId
                    ? lf("Delete {0} from your backpack on all devices?", confirmedItem.name)
                    : lf("Delete {0} from your backpack in this browser?", confirmedItem.name)}</p>
                {error && <p role="alert">{error}</p>}
            </div>
        </Modal>}
    </>;
}