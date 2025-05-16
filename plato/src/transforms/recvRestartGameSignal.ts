import * as simHost from "@/services/simHost";
import { clearPlayerCurrentGames } from "./clearPlayerCurrentGames";

export function recvRestartGameSignal(): void {
    simHost.simDriver()?.restart();
    clearPlayerCurrentGames();
}
