import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ArcadeSimulator from "./ArcadeSimulator";
import JoinCodeLabel from "./JoinCodeLabel";
import Presence from "./Presence";
import Reactions from "./Reactions";
import ToggleMuteButton from "./ToggleMuteButton";

export interface GamePageProps {}

export default function Render(props: GamePageProps) {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    return (
        <div>
            {netMode === "connecting" && (
                <div className="tw-text-lg tw-font-bold tw-mt-5">
                    {lf("Connecting...")}
                </div>
            )}
            {state.gameState?.gameMode && (
                <div className="tw-flex tw-flex-col tw-items-center">
                    {state.playerSlot && <ArcadeSimulator />}
                    <div className="tw-flex tw-flex-row tw-w-full tw-items-center tw-justify-between tw-mt-1">
                        <ToggleMuteButton />
                        <JoinCodeLabel />
                        <div>{lf("Keyboard Controls")}</div>
                    </div>
                    <div className="tw-flex tw-flex-row tw-space-x-2 tw-items-center tw-align-middle tw-justify-center tw-mt-3">
                        <Reactions />
                        <Presence />
                    </div>
                </div>
            )}
        </div>
    );
}
