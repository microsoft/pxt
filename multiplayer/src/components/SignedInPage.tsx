import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import JoinOrHost from "./JoinOrHost";
import GamePage from "./GamePage";
import CollabPage from "./CollabPage";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { netMode } = state;

    return (
        <div className="tw-flex tw-flex-col tw-items-start tw-gap-1 tw-grow tw-justify-around">
            {netMode === "init" && <JoinOrHost />}
            {netMode !== "init" && <GamePage />}
            {netMode !== "init" && <CollabPage />}
        </div>
    );
}
