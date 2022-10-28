import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import BetaTag from "./BetaTag";
import HostLobby from "./HostLobby";
import JoinCodeLabel from "./JoinCodeLabel";
import JoinLobby from "./JoinLobby";
import PresenceBar from "./PresenceBar";
import ToggleMuteButton from "./ToggleMuteButton";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { netMode, clientRole } = state;

    return (
        <>
            {netMode === "connecting" && (
                <div className="tw-text-xl tw-text-white tw-mt-5">
                    {lf("Connecting...")}
                </div>
            )}
            {state.gameState?.gameMode === "lobby" && (
                <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-w-full tw-h-full">
                    {clientRole === "host" && <HostLobby />}
                    {clientRole === "guest" && <JoinLobby />}
                </div>
            )}
            {state.gameState?.gameMode === "playing" && (
                <div className="tw-mx-2 tw-self-start tw-mb-1">
                    <BetaTag />
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
                    <JoinCodeLabel />
                    <div>{lf("Keyboard Controls")}</div>
                </div>
                <div className="tw-mt-3">
                    <PresenceBar />
                </div>
            </div>
        </>
    );
}
