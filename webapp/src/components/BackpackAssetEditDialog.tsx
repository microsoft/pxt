import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Blockly from "blockly";
import { Button } from "../../../react-common/components/controls/Button";
import { FocusTrap } from "../../../react-common/components/controls/FocusTrap";
import { Action, createStore, Store } from "redux";
import { BackpackAssetEditorContext } from "../backpack";
import { BackpackAssetEditor } from "../backpackAssetEditor";
import { getBackpackRequirements } from "../backpackProject";
import * as pkg from "../package";
import { ImageFieldEditor } from "./ImageFieldEditor";
import { AssetEditorContext } from "./AssetEditorContext";
import imageReducer, { ImageEditorStore } from "./ImageEditor/store/imageReducer";

interface BackpackAssetEditDialogProps {
    item: pxt.auth.BackpackItem;
    context: BackpackAssetEditorContext;
    onSave: (item: pxt.auth.BackpackItem) => Promise<void>;
    onClose: () => void;
    onOpenError: (message: string) => void;
}

/** The same native editor as the Assets tab, with a private project and undo store. */
export function BackpackAssetEditDialog(props: BackpackAssetEditDialogProps): JSX.Element {
    const overlay = React.useRef<HTMLDivElement>();
    const scalarHost = React.useRef<HTMLDivElement>();
    const editor = React.useRef<ImageFieldEditor<pxt.Asset>>();
    const session = React.useRef<BackpackAssetEditor>();
    const store = React.useRef<Store<ImageEditorStore>>();
    const saving = React.useRef(false);
    const saveRef = React.useRef<() => Promise<void>>();
    const [asset, setAsset] = React.useState<pxt.Asset>();
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string>();

    React.useLayoutEffect(() => {
        // Native scalar fields use Blockly's shared popup containers. Keep them
        // inside the dialog's focus/inert boundary. Blockly positions them
        // relative to their parent and may reparent them to the scratch workspace.
        if (!Blockly.WidgetDiv.getDiv()) Blockly.WidgetDiv.createDom();
        if (!document.querySelector(".blocklyDropDownDiv")) Blockly.DropDownDiv.createDom();
        const popups = [Blockly.WidgetDiv.getDiv(), Blockly.DropDownDiv.getContentDiv().parentElement]
            .map(element => ({ element, parent: element.parentElement, next: element.nextSibling }));
        for (const { element } of popups) {
            scalarHost.current.appendChild(element);
        }
        const siblings = Array.from(document.body.children).filter(child => child !== overlay.current)
            .map(child => ({ child, hidden: child.getAttribute("aria-hidden"), inert: child.getAttribute("inert") }));
        for (const { child } of siblings) {
            child.setAttribute("aria-hidden", "true");
            child.setAttribute("inert", "");
        }
        return () => {
            Blockly.DropDownDiv.hideWithoutAnimation();
            Blockly.WidgetDiv.hide();
            for (const { element, parent, next } of popups) {
                parent.insertBefore(element, next?.parentNode === parent ? next : null);
            }
            for (const { child, hidden, inert } of siblings) {
                if (hidden === null) child.removeAttribute("aria-hidden");
                else child.setAttribute("aria-hidden", hidden);
                if (inert === null) child.removeAttribute("inert");
                else child.setAttribute("inert", inert);
            }
        };
    }, []);

    React.useLayoutEffect(() => {
        const current = new BackpackAssetEditor(new pxt.TilemapProject());
        session.current = current;
        store.current = createStore((state: ImageEditorStore | undefined, action: Action) => imageReducer(state, action, current.project));
        try {
            setAsset(current.open({ code: props.item.code, gallery: props.context.gallery, name: props.item.name }, scalarHost.current));
        } catch {
            props.onOpenError(lf("This saved asset could not be opened. Its block definition or required asset data is unavailable. Delete it and save a new copy from its source project."));
        }
        return () => {
            session.current = undefined;
            current.dispose();
        };
    }, []);

    const save = async (): Promise<void> => {
        const current = session.current;
        if (!current || saving.current) return;
        saving.current = true;
        setPending(true);
        setError(undefined);
        try {
            const result = current.save(editor.current?.getValue());
            const requirements = getBackpackRequirements(result.code, props.context.blocksInfo, pkg.mainPkg);
            await props.onSave({ ...props.item, ...result, ...requirements, name: result.name || props.item.name,
                versions: { target: pxt.appTarget.versions.target, pxt: pxt.appTarget.versions.pxt } });
        } catch (reason) {
            if (session.current === current) setError(reason instanceof Error ? reason.message : lf("Could not save this asset. Please try again."));
        } finally {
            saving.current = false;
            if (session.current === current) setPending(false);
        }
    };
    saveRef.current = save;

    const dismiss = (): void => {
        if (saving.current) return;
        void save();
    };
    const editorRef = React.useCallback((value: ImageFieldEditor<pxt.Asset>): void => {
        editor.current = value;
        if (!value || !asset) return;
        value.init(asset, () => { void saveRef.current(); }, {
            blocksInfo: props.context.blocksInfo, hideMyAssets: true, headerVisible: true
        });
    }, [asset]);
    return ReactDOM.createPortal(<div ref={overlay} className="project-backpack__asset-modal-overlay"
        onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
        <FocusTrap className="project-backpack__asset-modal" role="dialog" ariaLabel={lf("Backpack asset editor")}
            onEscape={dismiss}>
            <div className="project-backpack__native-editor" aria-busy={pending}>
                <div ref={scalarHost} hidden={!!asset} className="project-backpack__scalar-editor" />
                {asset && <AssetEditorContext.Provider value={session.current.project}>
                    <ImageFieldEditor ref={editorRef} store={store.current} singleFrame={asset.type !== pxt.AssetType.Animation}
                        editorType={asset.type === pxt.AssetType.Song ? "music" : "image"} includeSpecialTagsInFilter />
                </AssetEditorContext.Provider>}
                {!asset && <Button className="image-editor-confirm" label={lf("Done")} title={lf("Done")} onClick={dismiss} />}
            </div>
            {(pending || error) && <div className="project-backpack__asset-modal-status">
                {error ? <p role="alert">{error}</p> : <p role="status">
                    {lf("Saving asset…")}
                </p>}
                {error && <Button label={lf("Retry")} title={lf("Retry")} onClick={() => void save()} />}
            </div>}
        </FocusTrap>
    </div>, document.body);
}