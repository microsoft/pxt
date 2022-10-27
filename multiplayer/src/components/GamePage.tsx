import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import HostLobby from "./HostLobby";
import JoinCodeLabel from "./JoinCodeLabel";
import JoinLobby from "./JoinLobby";
import PresenceBar from "./PresenceBar";
import ToggleMuteButton from "./ToggleMuteButton";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    return (
        <>
            {netMode === "connecting" && (
                <div className="tw-text-xl tw-text-white tw-mt-5">
                    {lf("Connecting...")}
                </div>
            )}

            {state.gameState?.gameMode === "lobby" && (
                <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-w-full tw-h-full">
                    {state.appMode.uiMode === "host" && <HostLobby />}
                    {state.appMode.uiMode === "join" && <JoinLobby />}
                </div>
            )}
            <div
                className={`tw-flex tw-flex-col tw-items-center ${
                    state.gameState?.gameMode === "playing" ? "" : "hidden"
                }`}
            >
                <ArcadeSimulator />
                <div className="tw-flex tw-flex-row tw-w-full tw-items-center tw-justify-between tw-mt-1">
                    <ToggleMuteButton />
                    <div className="tw-flex tw-flex-row">
                        <div className="tw-pr-[0.3rem]">{lf("Join Code: ")}</div>
                        <JoinCodeLabel />
                    </div>
                    <div>{lf("Keyboard Controls")}</div>
                </div>
                <div className="tw-mt-3">
                    <PresenceBar />
                </div>
            </div>
        </>
    );
}
