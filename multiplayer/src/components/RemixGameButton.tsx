import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);

    const remixUrl = state.gameId
        ? `${pxt.webConfig.relprefix.replace(/-+$/, "")}#pub:${state.gameId}`
        : undefined;

    function handleRemixGameClick() {
        if (remixUrl) {
            window.open(remixUrl);
        }
    }

    return remixUrl ? (
        <Button
            leftIcon={"fas fa-bolt"}
            title={lf("Remix Game")}
            label={lf("Remix Game")}
            onClick={handleRemixGameClick}
            className="tw-border-2 tw-border-slate-400 tw-border-solid tw-p-2 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms]"
        />
    ) : null;
}
