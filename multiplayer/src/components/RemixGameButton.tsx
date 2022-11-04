import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const gameId = state.gameState?.gameId;

    const remixUrl = gameId
        ? `${pxt.webConfig.relprefix.replace(/-+$/, "")}#pub:${gameId}`
        : undefined;

    function handleRemixGameClick() {
        if (remixUrl) {
            window.open(remixUrl);
        }
    }

    return remixUrl ? (
        // TODO multiplayer : Consolidate these two buttons somehow...
        <>
            <Button
                leftIcon={"fas fa-bolt"}
                title={lf("Remix Game")}
                label={lf("Remix Game")}
                onClick={handleRemixGameClick}
                className="tw-hidden sm:tw-inline tw-border-2 tw-border-slate-400 tw-border-solid tw-p-2 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms]"
            />
            <Button
                leftIcon={"fas fa-bolt"}
                title={lf("Remix Game")}
                onClick={handleRemixGameClick}
                className="sm:tw-hidden tw-border-2 tw-border-slate-400 tw-border-solid tw-p-2 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms]"
            />
        </>
    ) : null;
}
