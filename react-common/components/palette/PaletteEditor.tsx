import { useEffect, useState } from "react";
import { ColorPickerField } from "./ColorPickerField";
import { Palette } from "./Palettes";

export interface PaletteEditorProps {
    palette: Palette;
    onPaletteChanged: (newPalette: Palette) => void;
}

export const PaletteEditor = (props: PaletteEditorProps) => {
    const { palette, onPaletteChanged } = props;

    const [currentPalette, setCurrentPalette] = useState<Palette | undefined>(palette);

    useEffect(() => {
        onPaletteChanged(currentPalette);
    }, [currentPalette]);

    useEffect(() => {
        setCurrentPalette(palette);
    }, [palette]);

    const updateColor = (index: number, newColor: string) => {
        const toUpdate = currentPalette;
        setCurrentPalette({
            ...toUpdate,
            colors: toUpdate.colors.map((c, i) =>
                index === i ? newColor : c
            )
        });
    }

    const moveColor = (index: number, up: boolean) => {
        const toUpdate = currentPalette;
        const res = {
            ...toUpdate,
            colors: toUpdate.colors.slice()
        };

        if (up) {
            if (index > 1) {
                res.colors[index - 1] = toUpdate.colors[index];
                res.colors[index] = toUpdate.colors[index - 1];
            }
        }
        else {
            if (index < res.colors.length - 1) {
                res.colors[index + 1] = toUpdate.colors[index];
                res.colors[index] = toUpdate.colors[index + 1];
            }
        }
        setCurrentPalette(res);
    }

    return <div className="common-palette-editor">
        {currentPalette.colors.slice(1).map((c, i) =>
            <ColorPickerField
                key={i}
                index={i}
                color={c}
                onColorChanged={newColor => updateColor(i + 1, newColor)}
                onMoveColor={up => moveColor(i + 1, up)}
            />
        )}
    </div>
}