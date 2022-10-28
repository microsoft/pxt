import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import JoinOrHost from "./JoinOrHost";
import GamePage from "./GamePage";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { netMode } = state;

    return (
        <div className="tw-pt-3 tw-pb-8 tw-flex tw-flex-col tw-items-center tw-gap-1 tw-h-screen">
            {netMode === "init" && <JoinOrHost />}
            {netMode !== "init" && <GamePage />}
        </div>
    );
}
