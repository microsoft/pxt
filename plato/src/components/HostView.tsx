import css from "./HostView.module.scss";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { HostNetState } from "@/state/state";
import { getClientRole } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";

export function HostView() {
    const context = useContext(AppStateContext);
    const { state } = context;
    const clientRole = getClientRole(context);
    const viewState = state.viewState as HostNetState;

    if (clientRole !== "host" || !viewState || viewState.type !== "host") {
        return null;
    }

    return (
        <div className={css["host-view"]}>
            <div className={css["controls"]}>
                <p className={css["label"]}>{lf("Game Link")}<i className="fas fa-question-circle" onClick={() => { }}></i></p>
                <div className={css["share-link"]}>
                    <Input
                        className={css["share-link"]}
                        placeholder="https://makecode.com/<share-code>"
                    />
                    <Button
                        className={css["load"]}
                        label={lf("Load")}
                        title={lf("Load")}
                        onClick={() => { }}
                    />
                </div>
                <p></p>
                <p className={css["label"]}>{lf("Join Code")}<i className="fas fa-question-circle" onClick={() => { }}></i></p>
                <div className={css["join-code-group"]}>
                    <div className={css["join-code"]}>
                        {viewState.joinCode ?? "------"}
                    </div>
                    <Button
                        className={css["copy"]}
                        label={lf("Copy Code")}
                        title={lf("Copy Code")}
                        onClick={() => { }}
                    />
                    <Button
                        className={css["copy-link"]}
                        label={lf("Copy URL")}
                        title={lf("Copy URL")}
                        onClick={() => { }}
                    />
                </div>
            </div>
            <div className={css["presence"]}>
                {lf("Presence")}
            </div>
            <div className={css["sim"]}>
                {lf("Sim")}
            </div>
        </div>
    )
}
