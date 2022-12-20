import { Dropdown } from "../controls/Dropdown";
import { Palette } from "./Palettes";
import { PaletteSwatch } from "./PaletteSwatch";

export interface PalettePickerProps {
    palettes: Palette[];
    selectedId: string;
    onPaletteSelected: (selected: Palette) => void;
}

export const PalettePicker = (props: PalettePickerProps) => {
    const { palettes, selectedId, onPaletteSelected } = props;

    const onItemSelected = (id: string) => {
        onPaletteSelected(palettes.find(p => p.id === id));
    }

    return <Dropdown
            id="common-palette-picker"
            selectedId={selectedId}
            onItemSelected={onItemSelected}
            items={palettes.map(p => ({
                id: p.id,
                title: p.name,
                label: <PaletteSwatch palette={p} />
            }))}
        />
}