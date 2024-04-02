import css from "./styling/AssetEditorFrame.module.scss";

import React, { useContext, useState } from "react";

import { AssetEditorDriver } from "pxtservices/assetEditorDriver";
import { AppStateContext } from "../state/appStateContext";
import { getAssetFromFiles, getProjectAnimatedTileset, getProjectFiles, getProjectTileset, getTileId } from "../utils/project";
import { Asset } from "../types/project";
import { IframeDriver } from "pxtservices/iframeDriver";


interface IProps {
    assetId: number;
    onAssetChanged: (asset: Asset) => void;
    updateTileset?: boolean;
}

export const AssetEditorFrame: React.FC<IProps> = ({ assetId, onAssetChanged, updateTileset }) => {
    const [ frameId ] = useState(pxt.Util.guidGen());
    const [ iFrameDriver, setIFrameDriver ] = useState<AssetEditorDriver>();
    const { state } = useContext(AppStateContext);

    function createIFrameUrl(): string {
        const editorUrl: string = pxt.BrowserUtils.isLocalHost()
            ? "http://localhost:3232/--asseteditor"
            : "/--asseteditor";
        return `${editorUrl}?frameid=${frameId}`;
    }

    const handleIFrameRef = (el: HTMLIFrameElement | null) => {
        if (el && !iFrameDriver) {
            const driver = new AssetEditorDriver(el);
            setIFrameDriver(driver);
        }
    };

    React.useEffect(() => {
        if (!iFrameDriver) return;

        const onSave = () => {
            (async () => {
                const files = await iFrameDriver.saveAsset();
                onAssetChanged(getAssetFromFiles(state.project, assetId, files))
            })()
        }
        iFrameDriver.addEventListener("done-clicked", onSave);

        return () => iFrameDriver.removeEventListener("done-clicked", onSave);
    }, [iFrameDriver, assetId, onAssetChanged]);

    React.useEffect(() => {
        if (iFrameDriver) {
            const { files, pxtAsset } = getProjectFiles(state.project, assetId);
            iFrameDriver.openAsset(pxtAsset.id, pxtAsset.type, files, state.project.palette);
        }
    }, [iFrameDriver, assetId]);

    React.useEffect(() => {
        if (iFrameDriver) {
            const { files } = getProjectFiles(state.project, assetId);
            iFrameDriver.updateTileset(getProjectTileset(state.project), getProjectAnimatedTileset(state.project), files, state.project.palette)

            const asset = state.project.assets.find(a => a.id === assetId);

            if (asset?.kind !== "tilemap" || !iFrameDriver) return;

            const tileAsset = state.project.assets.find(a => a.id === state.currentImageId);

            iFrameDriver.setSelectedTile(getTileId(tileAsset!));
        }
    }, [IframeDriver, updateTileset, state.project.revision]);

    React.useEffect(() => {
        const asset = state.project.assets.find(a => a.id === assetId);

        if (asset?.kind !== "tilemap" || !iFrameDriver) return;

        const tileAsset = state.project.assets.find(a => a.id === state.currentImageId);

        iFrameDriver.setSelectedTile(getTileId(tileAsset!));
    }, [IframeDriver, assetId, state.currentImageId]);


    return (
        <iframe className={css["asset-editor-frame"]} src={createIFrameUrl()} ref={handleIFrameRef} />
    );
};