import * as React from "react";
import * as ReactDOM from "react-dom";
import { Button } from "../../../react-common/components/controls/Button";
import { FocusTrap } from "../../../react-common/components/controls/FocusTrap";
import { AssetEditorDriver } from "../../../pxtservices/assetEditorDriver";
import { BackpackAssetEditorContext } from "../backpack";

interface BackpackAssetEditDialogProps {
    item: pxt.auth.BackpackItem;
    context: BackpackAssetEditorContext;
    onSave: (item: pxt.auth.BackpackItem) => Promise<void>;
    onClose: () => void;
    onOpenError: (message: string) => void;
}

/** The native editor runs in its own asset project, never the open game's project. */
export function BackpackAssetEditDialog(props: BackpackAssetEditDialogProps): JSX.Element {
    const overlay = React.useRef<HTMLDivElement>();
    const frame = React.useRef<HTMLIFrameElement>();
    const driver = React.useRef<AssetEditorDriver>();
    const saving = React.useRef(false);
    const saveRef = React.useRef<() => Promise<void>>();
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const url = React.useMemo(() => {
        const result = new URL(pxt.webConfig.asseteditorUrl || "asseteditor.html", window.location.href);
        result.searchParams.set("frameid", pxt.U.guidGen());
        return result.toString();
    }, []);

    React.useLayoutEffect(() => {
        if (!ready) return undefined;
        const siblings = Array.from(document.body.children).filter(child => child !== overlay.current)
            .map(child => ({ child, hidden: child.getAttribute("aria-hidden"), inert: child.getAttribute("inert") }));
        for (const { child } of siblings) {
            child.setAttribute("aria-hidden", "true");
            child.setAttribute("inert", "");
        }
        return () => {
            for (const { child, hidden, inert } of siblings) {
                if (hidden === null) child.removeAttribute("aria-hidden");
                else child.setAttribute("aria-hidden", hidden);
                if (inert === null) child.removeAttribute("inert");
                else child.setAttribute("inert", inert);
            }
        };
    }, [ready]);

    React.useEffect(() => {
        const client = new AssetEditorDriver(frame.current);
        driver.current = client;
        const onDone = (): void => { void saveRef.current(); };
        void pxt.U.promiseTimeout(30000, client.openBackpackAsset(props.item.code, props.context.blocksInfo,
            props.context.gallery, props.context.palette, props.item.name)).then(() => {
                if (driver.current !== client) return;
                client.addEventListener("done-clicked", onDone);
                setReady(true);
                frame.current?.focus();
            }).catch(reason => {
                if (driver.current !== client) return;
                const code = reason instanceof Error ? reason.message : reason;
                props.onOpenError(code === "backpack_editor_incompatible"
                    ? lf("The asset editor is from a different build and cannot open Backpack assets. Reload the editor; if this continues, publish the matching asset-editor build.")
                    : code === "backpack_asset_unavailable"
                    ? lf("This saved asset could not be opened. Its block definition or required asset data is unavailable. Delete it and save a new copy from its source project.")
                    : lf("The asset editor did not finish loading. Reload the editor and try again."));
            });
        return () => {
            driver.current = undefined;
            client.removeEventListener("done-clicked", onDone);
            client.dispose();
        };
    }, []);

    const save = async (): Promise<void> => {
        const client = driver.current;
        if (!client || !ready || saving.current) return;
        saving.current = true;
        setPending(true);
        setError(undefined);
        try {
            const result = await pxt.U.promiseTimeout(30000, client.saveBackpackAsset());
            if (driver.current !== client) return;
            await props.onSave({ ...props.item, ...result, name: result.name || props.item.name,
                versions: { target: pxt.appTarget.versions.target, pxt: pxt.appTarget.versions.pxt } });
        } catch (reason) {
            if (driver.current === client) setError(reason instanceof Error ? reason.message : lf("Could not save this asset. Please try again."));
        } finally {
            saving.current = false;
            if (driver.current === client) setPending(false);
        }
    };
    saveRef.current = save;

    const dismiss = (): void => {
        if (saving.current) return;
        if (ready) void save();
        else props.onClose();
    };
    return ReactDOM.createPortal(<div ref={overlay} className="project-backpack__asset-modal-overlay"
        style={{ visibility: ready ? undefined : "hidden" }}
        onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
        <FocusTrap className="project-backpack__asset-modal" role="dialog" ariaLabel={lf("Backpack asset editor")}
            onEscape={dismiss} dontStealFocus={!ready}>
            <iframe ref={frame} src={url} title={lf("Backpack asset editor")} sandbox="allow-scripts"
                tabIndex={ready && !pending ? 0 : -1} aria-hidden={!ready} aria-busy={!ready || pending} />
            {(pending || error) && <div className="project-backpack__asset-modal-status">
                {error ? <p role="alert">{error}</p> : <p role="status">
                    {lf("Saving asset…")}
                </p>}
                {error && <Button label={lf("Retry")} title={lf("Retry")} onClick={() => void save()} />}
            </div>}
        </FocusTrap>
    </div>, document.body);
}