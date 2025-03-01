import { stateAndDispatch } from "../state";
import { setCurrentEditingTheme } from "./setCurrentEditingTheme";

export function setThemeName(name: string) {
    const { state } = stateAndDispatch();
    const { editingTheme } = state;
    if (!editingTheme) return;

    if (editingTheme) {
        const id = name
            .toLocaleLowerCase()
            .replace(" ", "-")
            .replace(/[^a-z0-9-]/g, "");
        setCurrentEditingTheme({ ...editingTheme, id, name });
    }
}
