import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const gameId = state.gameState?.gameId;

    const remixUrl = gameId ? `${pxt.webConfig.relprefix.replace(/-+$/, "")}#pub:${gameId}` : undefined;

    function handleEditGameClick() {
        if (remixUrl) {
            pxt.tickEvent("mp.editgame");
            window.open(remixUrl);
        }
    }

    return remixUrl ? (
        <Button
            leftIcon={"fas fa-bolt"}
            title={lf("Edit Game")}
            label={<div className="tw-hidden sm:tw-inline tw-m-0 tw-p-0">{lf("Edit Game")}</div>}
            onClick={handleEditGameClick}
            className="tw-border-2 tw-border-slate-400 tw-border-solid tw-p-2 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms] tw-pr-1 sm:tw-pr-3"
        />
    ) : null;
}
