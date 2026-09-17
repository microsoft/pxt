import * as React from "react";
import { BackpackEntry, getBackpackAssetPreviewContext, getBackpackPreviewAsync, loadBackpackAssetPreviewAsync } from "../backpack";
import { backpackAssetPreview, BackpackAssetPreview } from "../backpackAssetPreview";

export interface BackpackPreviewProps {
    entry: BackpackEntry;
    headerId: string;
    active: boolean;
    onDragStart?: React.DragEventHandler<HTMLElement>;
    onDragEnd?: React.DragEventHandler<HTMLElement>;
}

/** Fetch only visible cloud previews; never use a public/bare private image URL. */
export function BackpackPreview({ entry, headerId, active, onDragStart, onDragEnd }: BackpackPreviewProps): JSX.Element {
    const host = React.useRef<HTMLDivElement>();
    const imageRef = React.useRef<HTMLImageElement>();
    const [image, setImage] = React.useState<{ url: string; version: string; asset?: BackpackAssetPreview }>();
    const loaded = React.useRef(false);
    const objectUrl = React.useRef<string>();
    const [failed, setFailed] = React.useState(false);
    const localUri = entry.item?.previewUri;
    const asset = (entry.item?.kind || entry.summary?.kind) === "asset";
    const assetLabel = React.useMemo(() => {
        if (!asset) return undefined;
        let type = entry.summary?.blockTypes[0];
        if (!type) {
            try { type = JSON.parse(entry.item.code).blocks[0].type; }
            catch { return lf("Asset"); }
        }
        return type.includes("animation") ? lf("Animation") : /music|melody/.test(type) ? lf("Music")
            : type === "tiles_tilemap_editor" ? lf("Tilemap") : lf("Image");
    }, [asset, entry.item?.code, entry.summary?.blockTypes]);
    const density = entry.item?.previewPixelDensity || entry.summary?.previewPixelDensity;
    const functionCount = React.useMemo(() => {
        if (entry.error) return 0;
        if (entry.summary) return entry.summary.functionCount || 0;
        try {
            const blocks = JSON.parse(entry.item?.code).blocks;
            // The selected container is last; count only its supporting definitions.
            return Array.isArray(blocks) ? blocks.slice(0, -1).filter(block =>
                block?.type === "function_definition" || block?.type === "procedures_defnoreturn").length : 0;
        } catch { return 0; }
    }, [entry.item?.code, entry.summary?.functionCount, entry.error]);
    React.useEffect(() => {
        loaded.current = false;
        setImage(undefined);
        setFailed(false);
        return () => {
            if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
            objectUrl.current = undefined;
        };
    }, [headerId, entry.id, entry.source, entry.item?.code, entry.summary?.version, localUri, entry.error, asset]);
    React.useEffect(() => {
        if (loaded.current) return undefined;
        if (!active || localUri || (!asset && !entry.summary?.hasPreview) || entry.error) return undefined;
        setFailed(false);
        const controller = new AbortController();
        let started = false;
        let observer: IntersectionObserver;
        const load = () => {
            if (started) return;
            started = true;
            observer?.disconnect();
            void (async () => {
                if (asset) {
                    const item = await loadBackpackAssetPreviewAsync(entry);
                    if (controller.signal.aborted) return;
                    const preview = backpackAssetPreview(item, getBackpackAssetPreviewContext(headerId));
                    if (!preview) { setFailed(true); return; }
                    loaded.current = true;
                    setImage({ url: preview.previewURI, version: entry.summary?.version, asset: preview });
                } else {
                    const blob = await getBackpackPreviewAsync(entry, controller.signal);
                    if (controller.signal.aborted) return;
                    objectUrl.current = URL.createObjectURL(blob);
                    loaded.current = true;
                    setImage({ url: objectUrl.current, version: entry.summary.version });
                }
            })().catch(() => { if (!controller.signal.aborted) setFailed(true); });
        };
        if (typeof IntersectionObserver === "undefined") load();
        else {
            observer = new IntersectionObserver(records => {
                if (records.some(record => record.isIntersecting)) load();
            });
            observer.observe(host.current);
        }
        return () => {
            controller.abort();
            observer?.disconnect();
        };
    }, [active, headerId, entry.id, entry.source, entry.item?.code, entry.summary?.version, localUri, entry.error, asset]);
    const uri = localUri || (image?.version === entry.summary?.version ? image?.url : undefined);
    React.useEffect(() => {
        const frames = image?.asset?.framePreviewURIs;
        const element = imageRef.current;
        if (!active || !element || !frames || frames.length < 2) return undefined;
        let timer: ReturnType<typeof setInterval>;
        const stop = (): void => { clearInterval(timer); element.src = image.url; };
        const start = (): void => {
            stop();
            let index = 0;
            timer = setInterval(() => { element.src = frames[index++ % frames.length]; }, Math.max(image.asset.interval || 100, 100));
        };
        element.addEventListener("mouseenter", start);
        element.addEventListener("mouseleave", stop);
        return () => {
            stop();
            element.removeEventListener("mouseenter", start);
            element.removeEventListener("mouseleave", stop);
        };
    }, [active, image]);
    return <div ref={host} style={{ minHeight: asset || entry.summary?.hasPreview ? 44 : undefined }}>
        {asset && !uri && <div className="project-backpack__asset" draggable={!!onDragStart}
            onDragStart={onDragStart} onDragEnd={onDragEnd} title={onDragStart ? lf("Drag to add to project") : undefined}>
            <i className={`icon ${assetLabel === lf("Music") ? "music" : "image"}`} aria-hidden="true" />
            <span>{assetLabel}</span>
        </div>}
        {uri && <img ref={imageRef} className={`project-backpack__preview${asset ? " project-backpack__preview--asset" : ""}`} src={density ? undefined : uri}
            srcSet={density ? `${uri} ${density}x` : undefined} alt={asset ? lf("Preview of {0}", entry.name) : lf("Blocks in {0}", entry.name)}
            draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}
            title={onDragStart ? lf("Drag to add to project") : undefined} />}
        {failed && <p>{lf("Preview unavailable. You can still add this snippet.")}</p>}
        {functionCount > 0 && <p>{functionCount === 1
            ? lf("+ 1 other function") : lf("+ {0} other functions", functionCount)}</p>}
    </div>;
}