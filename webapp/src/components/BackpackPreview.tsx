import * as React from "react";
import { BackpackEntry, getBackpackPreviewAsync } from "../backpack";

export interface BackpackPreviewProps {
    entry: BackpackEntry;
    active: boolean;
    onDragStart?: React.DragEventHandler<HTMLElement>;
    onDragEnd?: React.DragEventHandler<HTMLElement>;
}

/** Fetch only visible cloud previews; never use a public/bare private image URL. */
export function BackpackPreview({ entry, active, onDragStart, onDragEnd }: BackpackPreviewProps): JSX.Element {
    const host = React.useRef<HTMLDivElement>();
    const [image, setImage] = React.useState<{ url: string; version: string }>();
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
        setImage(undefined);
        setFailed(false);
        if (!active || localUri || !entry.summary?.hasPreview || entry.error) return undefined;
        const controller = new AbortController();
        let objectUrl: string;
        let started = false;
        let observer: IntersectionObserver;
        const load = () => {
            if (started) return;
            started = true;
            observer?.disconnect();
            void getBackpackPreviewAsync(entry, controller.signal).then(blob => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setImage({ url: objectUrl, version: entry.summary.version });
            }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
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
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [active, entry.id, entry.source, entry.summary?.version, localUri, entry.error]);
    const uri = localUri || (active && image?.version === entry.summary?.version ? image?.url : undefined);
    return <div ref={host} style={{ minHeight: entry.summary?.hasPreview ? 1 : undefined }}>
        {asset && <div className="project-backpack__asset" draggable={!!onDragStart}
            onDragStart={onDragStart} onDragEnd={onDragEnd} title={onDragStart ? lf("Drag to add to project") : undefined}>
            <i className={`icon ${assetLabel === lf("Music") ? "music" : "image"}`} aria-hidden="true" />
            <span>{assetLabel}</span>
        </div>}
        {uri && <img className="project-backpack__preview" src={density ? undefined : uri}
            srcSet={density ? `${uri} ${density}x` : undefined} alt={lf("Blocks in {0}", entry.name)}
            draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}
            title={onDragStart ? lf("Drag to add to project") : undefined} />}
        {failed && <p>{lf("Preview unavailable. You can still add this snippet.")}</p>}
        {functionCount > 0 && <p>{functionCount === 1
            ? lf("+ 1 other function") : lf("+ {0} other functions", functionCount)}</p>}
    </div>;
}