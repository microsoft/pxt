import { navigate } from "./navigate";
import { KioskState } from "../Types";

export function showMainMenu() {
    navigate(KioskState.MainMenu);
}
