import { Button } from "react-common/components/controls/Button";
import { AssetPreviewList } from "./AssetPreviewList";
import css from "./styling/ImageEditorSidebar.module.scss";
import { createNewImageAsset } from "../transforms/createNewImageAsset";
import { ImageEditorTabs } from "./ImageEditorTabs";

interface IProps {

}

export const ImageEditorSidebar: React.FC<IProps> = (props) => {

    return (
        <div className={css["image-editor-sidebar"]}>
            <ImageEditorTabs />
            <div className={css["asset-preview-list"]}>
                <AssetPreviewList />
            </div>
            <Button
                onClick={createNewImageAsset}
                title={lf("New Asset")}
                label={lf("Create New")}
            />
        </div>
    );
}