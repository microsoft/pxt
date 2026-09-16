import * as React from "react";
import { Modal } from "../../../react-common/components/controls/Modal";
import { AssetEditorDriver } from "../../../pxtservices/assetEditorDriver";
import { BackpackAssetEditorContext } from "../backpack";

interface BackpackAssetEditDialogProps {
    item: pxt.auth.BackpackItem;
    context: BackpackAssetEditorContext;
    onSave: (item: pxt.auth.BackpackItem) => Promise<void>;
    onClose: () => void;
}

/** The native editor runs in its own asset project, never the open game's project. */
export function BackpackAssetEditDialog(props: BackpackAssetEditDialogProps): JSX.Element {
    const frame = React.useRef<HTMLIFrameElement>();
    const driver = React.useRef<AssetEditorDriver>();
    const alive = React.useRef(true);
    const saving = React.useRef(false);
    const [name, setName] = React.useState(props.item.name);
    const [ready, setReady] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();
    const url = React.useMemo(() => {
        const result = new URL(pxt.webConfig.asseteditorUrl || "asseteditor.html", window.location.href);
        result.searchParams.set("frameid", pxt.U.guidGen());
        return result.toString();
    }, []);

    React.useEffect(() => {
        alive.current = true;
        const client = new AssetEditorDriver(frame.current);
        driver.current = client;
        void pxt.U.promiseTimeout(30000, client.openBackpackAsset(props.item.code, props.context.blocksInfo,
            props.context.gallery, props.context.palette)).then(() => {
                if (alive.current) setReady(true);
            }).catch(() => {
                if (alive.current) setError(lf("Could not open this asset editor. Close it and try again."));
            });
        return () => { alive.current = false; client.dispose(); };
    }, []);

    const save = async (): Promise<void> => {
        if (!ready || saving.current) return;
        saving.current = true;
        setPending(true);
        setError(undefined);
        try {
            const result = await pxt.U.promiseTimeout(30000, driver.current.saveBackpackAsset());
            if (!alive.current) return;
            await props.onSave({ ...props.item, ...result, name: name.trim(),
                versions: { target: pxt.appTarget.versions.target, pxt: pxt.appTarget.versions.pxt } });
        } catch (reason) {
            if (alive.current) setError(reason instanceof Error ? reason.message : lf("Could not save this asset. Please try again."));
        } finally {
            saving.current = false;
            if (alive.current) setPending(false);
        }
    };

    return <Modal title={lf("Edit Backpack asset")} className="project-backpack__asset-modal" fullscreen
        hideDismissButton={pending} onClose={() => { if (!saving.current) props.onClose(); }} actions={[
            { label: lf("Cancel"), className: "neutral", disabled: pending, onClick: props.onClose },
            { label: lf("Save"), disabled: pending || !ready || !name.trim(), onClick: () => void save() }
        ]}>
        <div className="project-backpack__asset-name">
            <label htmlFor="project-backpack-asset-name">{lf("Asset name")}</label>
            <input id="project-backpack-asset-name" value={name} maxLength={100} disabled={pending}
                onChange={event => setName(event.target.value)} />
        </div>
        {!ready && !error && <p role="status">{lf("Loading asset editor…")}</p>}
        {error && <p role="alert">{error}</p>}
        <iframe ref={frame} src={url} title={lf("Backpack asset editor")} sandbox="allow-scripts"
            aria-busy={!ready || pending} />
    </Modal>;
}