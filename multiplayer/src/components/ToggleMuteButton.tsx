import { useContext, useEffect } from "react";
import { Button } from "react-common/components/controls/Button";
import { setMute } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import { simDriver } from "../services/simHost";

export default function Render() {
    const { state } = useContext(AppStateContext);

    const toggleMute = () => {
        dispatch(setMute(!state.muted));
    };

    useEffect(() => {
        simDriver()?.mute(state.muted);
    }, [state.muted]);

    return (
        <Button
            leftIcon={state.muted ? "fas fa-volume-mute" : "fas fa-volume-up"}
            title={lf("Toggle Mute")}
            className="tw-border-2 tw-border-slate-400 tw-border-solid tw-py-2 tw-pl-2 tw-pr-1 tw-bg-slate-100 hover:tw-bg-slate-200 active:tw-bg-slate-300 tw-ease-linear tw-duration-[50ms]"
            onClick={toggleMute}
        />
    );
}
