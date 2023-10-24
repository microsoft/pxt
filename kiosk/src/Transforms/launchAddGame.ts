import { KioskState } from "../Types";
import { navigate } from "./navigate";

export function launchAddGame() {
    navigate(KioskState.AddingGame);
}
