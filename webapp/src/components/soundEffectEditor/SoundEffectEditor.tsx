import * as React from "react";
import { Button } from "../../../../react-common/components/controls/Button";
import { SoundControls } from "./SoundControls";
import { SoundEffectHeader } from "./SoundEffectHeader";
import { SoundPreview } from "./SoundPreview";

export interface SoundEffectEditorProps {

}

export const SoundEffectEditor = (props: SoundEffectEditorProps) => {
    const [selectedView, setSelectedView] = React.useState<"editor" | "gallery">("editor");

    const onClose = () => {

    }

    const onViewSelected = (view: "editor" | "gallery") => {
        setSelectedView(view);
    }

    return <div className="sound-effect-editor">
        <SoundEffectHeader
            selectedView={selectedView}
            onViewSelected={onViewSelected}
            onClose={onClose}
        />
        <SoundPreview />
        <SoundControls />
        <Button
            label={pxt.U.lf("Generate Similar Sound")}
            title={pxt.U.lf("Generate Similar Sound")}
            onClick={() => {}}
        />
    </div>
}