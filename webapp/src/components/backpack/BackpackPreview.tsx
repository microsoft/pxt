import * as React from "react";
import * as Blockly from "blockly";
import * as pxtblockly from "../../../../pxtblocks";
import { classList } from "../../../../react-common/components/util";
import { assetToGalleryItem } from "../../assets";
import { prepareBackpackAssetGallery } from "./assetEditor";
import {
    BackpackEntry,
    MAX_BACKPACK_PREVIEW_LENGTH,
    getBackpackAssetPreviewContext,
    getBackpackPreviewAsync,
    loadBackpackAssetPreviewAsync
} from "./service";

export interface BackpackAssetPreview {
    previewURI: string;
    framePreviewURIs?: string[];
    interval?: number;
}

export interface BackpackPreviewProps {
    entry: BackpackEntry;
    headerId: string;
    active: boolean;
    onDragStart?: React.DragEventHandler<HTMLElement>;
    onDragEnd?: React.DragEventHandler<HTMLElement>;
}

interface PreviewImage {
    url: string;
    version: string;
    asset?: BackpackAssetPreview;
}

export function BackpackPreview({ entry, headerId, active, onDragStart, onDragEnd }: BackpackPreviewProps): JSX.Element {
    const host = React.useRef<HTMLDivElement>();
    const imageRef = React.useRef<HTMLImageElement>();
    const loaded = React.useRef(false);
    const objectUrl = React.useRef<string>();

    const [image, setImage] = React.useState<PreviewImage>();
    const [failed, setFailed] = React.useState(false);

    const localUri = entry.item?.previewUri;
    const asset = (entry.item?.kind || entry.summary?.kind) === "asset";

    const assetKind = React.useMemo(() => {
        if (!asset) return undefined;

        let type = entry.summary?.blockTypes[0];
        if (!type) {
            try {
                type = JSON.parse(entry.item.code).blocks[0].type;
            } catch {
                return "asset";
            }
        }

        if (type.includes("animation")) return "animation";
        if (/music|melody/.test(type)) return "music";
        if (type === "tiles_tilemap_editor") return "tilemap";
        return "image";
    }, [asset, entry.item?.code, entry.summary?.blockTypes]);

    const density = entry.item?.previewPixelDensity || entry.summary?.previewPixelDensity;
    const functionCount = React.useMemo(() => {
        if (entry.error) return 0;
        if (entry.summary) return entry.summary.functionCount || 0;

        try {
            const blocks = JSON.parse(entry.item?.code).blocks;
            // The captured block is last; earlier blocks are supporting functions.
            return Array.isArray(blocks)
                ? blocks.slice(0, -1).filter(block => block?.type === "function_definition").length
                : 0;
        } catch {
            return 0;
        }
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
                    if (!preview) {
                        setFailed(true);
                        return;
                    }

                    loaded.current = true;
                    setImage({ url: preview.previewURI, version: entry.summary?.version, asset: preview });
                } else {
                    const blob = await getBackpackPreviewAsync(entry, controller.signal);
                    if (controller.signal.aborted) return;

                    objectUrl.current = URL.createObjectURL(blob);
                    loaded.current = true;
                    setImage({ url: objectUrl.current, version: entry.summary.version });
                }
            })().catch(() => {
                if (!controller.signal.aborted) setFailed(true);
            });
        };

        if (typeof IntersectionObserver === "undefined") {
            load();
        } else {
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
    usePreviewAnimation(active, image, imageRef);

    let assetLabel: string;
    switch (assetKind) {
        case "animation":
            assetLabel = lf("Animation");
            break;
        case "music":
            assetLabel = lf("Music");
            break;
        case "tilemap":
            assetLabel = lf("Tilemap");
            break;
        case "image":
            assetLabel = lf("Image");
            break;
        default:
            assetLabel = lf("Asset");
            break;
    }

    return (
        <div
            ref={host}
            style={{ minHeight: asset || entry.summary?.hasPreview ? 44 : undefined }}
        >
            {asset && !uri && (
                <div
                    className="project-backpack-asset"
                    draggable={!!onDragStart}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    title={onDragStart ? lf("Drag to add to project") : undefined}
                >
                    <i
                        className={classList("icon", assetKind === "music" ? "music" : "image")}
                        aria-hidden="true"
                    />
                    <span>{assetLabel}</span>
                </div>
            )}
            {uri && (
                <img
                    ref={imageRef}
                    className={classList("project-backpack-preview", asset && "project-backpack-preview-asset")}
                    src={density ? undefined : uri}
                    srcSet={density ? `${uri} ${density}x` : undefined}
                    alt={asset ? lf("Preview of {0}", entry.name) : lf("Blocks in {0}", entry.name)}
                    draggable={!!onDragStart}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    title={onDragStart ? lf("Drag to add to project") : undefined}
                />
            )}
            {failed && <p>{lf("Preview unavailable. You can still add this snippet.")}</p>}
            {functionCount > 0 && (
                <p>{functionCount === 1
                    ? lf("+ 1 other function")
                    : lf("+ {0} other functions", functionCount)}</p>
            )}
        </div>
    );
}

function usePreviewAnimation(active: boolean, image: PreviewImage, imageRef: React.RefObject<HTMLImageElement>): void {
    React.useEffect(() => {
        const frames = image?.asset?.framePreviewURIs;
        const element = imageRef.current;
        if (!active || !element || !frames || frames.length < 2) return undefined;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let timer: ReturnType<typeof setInterval>;
        const stop = (): void => {
            clearInterval(timer);
            element.src = image.url;
        };

        const start = (): void => {
            stop();
            let index = 0;
            timer = setInterval(() => {
                element.src = frames[index++ % frames.length];
            }, Math.max(image.asset.interval || 100, 100));
        };

        const updateMotion = (): void => {
            stop();
            element.removeEventListener("mouseenter", start);
            element.removeEventListener("mouseleave", stop);
            if (!reducedMotion.matches) {
                element.addEventListener("mouseenter", start);
                element.addEventListener("mouseleave", stop);
            }
        };

        updateMotion();
        reducedMotion.addEventListener("change", updateMotion);

        return () => {
            stop();
            reducedMotion.removeEventListener("change", updateMotion);
            element.removeEventListener("mouseenter", start);
            element.removeEventListener("mouseleave", stop);
        };
    }, [active, image]);
}

/** Render a copy of the block's SVG without loading assets or changing the workspace. */
export async function backpackPreviewAsync(block: Blockly.BlockSvg): Promise<{
    previewUri: string;
    previewPixelDensity: number;
} | undefined> {
    const source = block.getSvgRoot();
    if (!source) return undefined;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
        const copy = source.cloneNode(true) as SVGGElement;
        const next = block.getNextBlock()?.getSvgRoot();
        const nextIndex = next ? Array.from(source.children).indexOf(next) : -1;
        if (nextIndex >= 0) copy.children[nextIndex].remove();
        copy.removeAttribute("transform");
        svg.appendChild(copy);
        pxtblockly.cleanUpBlocklySvg(svg, block.workspace.getParentSvg());

        // Measure the copy without exposing it to interaction or screen readers.
        svg.setAttribute("aria-hidden", "true");
        svg.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none";
        document.body.appendChild(svg);
        const bounds = copy.getBBox();
        if (!bounds.width || !bounds.height) return undefined;
        svg.removeAttribute("style");
        svg.remove();

        const width = bounds.width + 2;
        const height = bounds.height + 2;
        const scale = Math.min(1, 320 / width, 160 / height);
        const rendered = await pxtblockly.blocklyToSvgAsync(svg, bounds.x - 1, bounds.y - 1, width, height, scale);
        if (!rendered) return undefined;

        // Start with enough pixels for a high-DPI display. Redraw from the SVG,
        // not a previously downsampled PNG, if a dense snippet exceeds the budget.
        for (const pixelDensity of [2, 1.5, 1]) {
            const image = await pxt.BrowserUtils.encodeToPngAsync(rendered.xml, {
                width: rendered.width,
                height: rendered.height,
                pixelDensity
            });
            if (!image) return undefined;
            if (image.length <= MAX_BACKPACK_PREVIEW_LENGTH) {
                return { previewUri: image, previewPixelDensity: pixelDensity };
            }
        }
        return undefined;
    } catch {
        // A failed thumbnail must not prevent saving the snippet.
        return undefined;
    } finally {
        svg.remove();
    }
}

/** Load saved fields in a separate project and workspace so previews cannot change the open project. */
export function backpackAssetPreview(
    item: pxt.auth.BackpackItem,
    context: {
        gallery: pxt.AssetSnapshot;
        blocksInfo: pxtc.BlocksInfo;
    }
): BackpackAssetPreview | undefined {
    if (item.kind !== "asset") return undefined;

    try {
        const { blocks } = pxtblockly.parseBackpackCode(item.code);
        const root = blocks[0];
        if (blocks.length !== 1 || root.next || Object.keys(root.inputs || {}).length) return undefined;

        const project = new pxt.TilemapProject();
        const { snapshot: gallery } = prepareBackpackAssetGallery(context.gallery, project);
        project.loadGallerySnapshot(gallery);

        const getTilemapProject = pxt.react.getTilemapProject;
        let workspace: Blockly.Workspace;
        Blockly.Events.disable(); // Blockly counts nested calls; finally restores the caller's event state.
        try {
            pxt.react.getTilemapProject = () => project;
            workspace = new Blockly.Workspace();
            // Use the blocks already registered by the active editor.
            const block = Blockly.serialization.blocks.append(root, workspace);
            const field = pxtblockly.getBackpackAssetField(block);
            let asset: pxt.Asset;

            if (field instanceof pxtblockly.FieldAssetEditor) {
                // A headless workspace does not run FieldBase's render-time initialization.
                field.onLoadedIntoWorkspace();
                if (!field.isGreyBlock) asset = field.getAsset();
            }
            else if (field instanceof pxtblockly.FieldTileset) {
                // Dropdown options may be stale after loadState; prefer the full saved state.
                const saved = root.fields?.[field.name];
                const tile = typeof saved === "object" ? pxtblockly.loadAssetFromSaveState(saved)
                    : project.lookupAsset(pxt.AssetType.Tile, saved)
                        || pxt.lookupProjectAssetByTSReference(saved, project)
                        || pxt.lookupProjectAssetByTSReference(field.getValue(), project)
                        || project.lookupAsset(pxt.AssetType.Tile, field.getValue());
                if (tile?.type === pxt.AssetType.Tile) asset = tile;
            }
            if (!asset) return undefined;

            // Gallery conversion adds image URIs, so give it a copy of the asset.
            const preview = assetToGalleryItem(pxt.cloneAsset(asset, true));
            if (!preview?.previewURI) return undefined;
            return preview.type === pxt.AssetType.Animation
                ? {
                    previewURI: preview.previewURI,
                    framePreviewURIs: preview.framePreviewURIs,
                    interval: preview.interval
                }
                : { previewURI: preview.previewURI };
        }
        finally {
            try {
                workspace?.dispose();
            }
            finally {
                pxt.react.getTilemapProject = getTilemapProject;
                Blockly.Events.enable();
            }
        }
    }
    catch {
        // The caller shows a fallback when a field cannot provide a preview.
        return undefined;
    }
}