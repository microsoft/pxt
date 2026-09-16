import * as React from "react";
import { BackpackEntry, getBackpackPreviewAsync } from "../backpack";

export interface BackpackPreviewProps {
    entry: BackpackEntry;
    active: boolean;
}

/** Fetch only visible cloud previews; never use a public/bare private image URL. */
export function BackpackPreview({ entry, active }: BackpackPreviewProps): JSX.Element {
    const host = React.useRef<HTMLDivElement>();
    const [image, setImage] = React.useState<{ url: string; version: string }>();
    const [failed, setFailed] = React.useState(false);
    const localUri = entry.item?.previewUri;
    const density = entry.item?.previewPixelDensity || entry.summary?.previewPixelDensity;
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
        {uri && <img className="project-backpack__preview" src={density ? undefined : uri}
            srcSet={density ? `${uri} ${density}x` : undefined} alt={lf("Blocks in {0}", entry.name)} />}
        {failed && <p>{lf("Preview unavailable. You can still add this snippet.")}</p>}
    </div>;
}