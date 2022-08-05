import * as React from "react";
import { Button } from "../controls/Button";
import { Dropdown } from "../controls/Dropdown";
import { PaletteEditor } from "./PaletteEditor";
import { Palette } from "./Palettes";
import { PaletteSwatch } from "./PaletteSwatch";

export interface PalettePickerProps {
    palettes: Palette[];
    selectedId: string;
    onPaletteSelected: (selected: Palette) => void;
}

export const PalettePicker = (props: PalettePickerProps) => {
    const { palettes, selectedId, onPaletteSelected } = props;

    const [editingPalette, setEditingPalette] = React.useState<Palette | undefined>(undefined);

    const onItemSelected = (id: string) => {
        onPaletteSelected(palettes.find(p => p.id === id));
    }

    const openPaletteEditor = () => {
        setEditingPalette(palettes.find(p => p.id === selectedId));
    }

    const onPaletteEdit = (newPalette: Palette) => {
        onPaletteSelected(newPalette);
        setEditingPalette(undefined);
    }

    return <div className="common-palette-picker">
        <Dropdown
            id="common-palette-picker"
            selectedId={selectedId}
            onItemSelected={onItemSelected}
            items={palettes.map(p => ({
                id: p.id,
                title: p.name,
                label: <PaletteSwatch palette={p} />
            }))}
        />
        <Button
            title={lf("Edit Palette")}
            leftIcon="fas fa-edit"
            onClick={openPaletteEditor}
        />
        {editingPalette &&
            <PaletteEditor palette={editingPalette} onPaletteChanged={onPaletteEdit}/>
        }
    </div>
}