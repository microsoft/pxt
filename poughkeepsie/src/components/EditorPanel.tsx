import css from "./styling/EditorPanel.module.scss";

import { ImageEditor } from "./ImageEditor";
import { SplitPane } from "./SplitPane";
import { TilemapEditor } from "./TilemapEditor";
import { EditorFrame } from "./EditorFrame";

export const EditorPanel: React.FC = () => {
    return (
        <div className={css["editor-panel"]}>
            <SplitPane
                split={"vertical"}
                defaultSize={"50%"}
                primary={"left"}
                left={
                    <SplitPane
                        split={"horizontal"}
                        defaultSize={"50%"}
                        primary={"left"}
                        left={<TilemapEditor />}
                        right={<ImageEditor />}
                        leftMinSize="5rem"
                        rightMinSize="5rem"
                    />
                }
                right={<EditorFrame />}
                leftMinSize="5rem"
                rightMinSize="5rem"
            />
        </div>
    );
}