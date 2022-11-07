import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import BetaTag from "./BetaTag";
import HostLobby from "./HostLobby";
import JoinCodeLabel from "./JoinCodeLabel";
import JoinLobby from "./JoinLobby";
import PresenceBar from "./PresenceBar";
import RemixGameButton from "./RemixGameButton";
import ToggleMuteButton from "./ToggleMuteButton";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { netMode, clientRole } = state;

    return (
        <>
            {netMode === "connecting" && <></>}
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
                <div className="tw-flex tw-flex-row tw-w-full tw-items-center tw-justify-between tw-mt-1 tw-ml-1">
                    <div>
                        <ToggleMuteButton />
                        <RemixGameButton />
                    </div>
                    <div className="tw-mr-1 sm:tw-mr-0">
                        <JoinCodeLabel />
                    </div>
                    <div className="tw-hidden sm:tw-inline">
                        {lf("Keyboard Controls")}
                    </div>
                </div>
                <div className="tw-mt-3">
                    <PresenceBar />
                </div>
            </div>
        </>
    );
}
