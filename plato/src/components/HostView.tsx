import css from "./HostView.module.scss";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { HostViewState } from "@/state/state";
import { getClientRole } from "@/state/helpers";

export function HostView() {
    const context = useContext(AppStateContext);
    const { state } = context;
    const clientRole = getClientRole(context);
    const viewState = state.viewState as HostViewState;

    if (clientRole !== "host" || !viewState || viewState.type !== "host") {
        return null;
    }

    return (
        <div className={css["host-view"]}>
            host view
        </div>
    )
}
