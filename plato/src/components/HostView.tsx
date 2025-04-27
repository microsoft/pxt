import css from "./HostView.module.scss";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { HostNetState } from "@/state/state";
import { getClientRole } from "@/state/helpers";
import { Input } from "react-common/components/controls/Input";
import { Button } from "react-common/components/controls/Button";
import { Link } from "react-common/components/controls/Link";
import { classlist } from "@/utils";

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
            <div className={classlist(css["panel"], css["controls"])}>
                <p className={css["label"]}>{lf("Game Link")}<i className="fas fa-question-circle" onClick={() => { }}></i></p>
                <div className={css["share-link"]}>
                    <Input
                        className={css["share-link"]}
                        placeholder="Paste your game link here"
                    />
                    <Button
                        className={css["load"]}
                        label={lf("Load")}
                        title={lf("Load")}
                        onClick={() => { }}
                    />
                </div>
                <p></p>
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
                        label={lf("Copy Join Link")}
                        title={lf("Copy Join Link")}
                        onClick={() => { }}
                    />
                </div>
            </div>
            <div className={classlist(css["panel"], css["presence"])}>
                {lf("Presence")}
            </div>
            <div className={classlist(css["panel"], css["sim"])}>
                {lf("Sim")}
            </div>
        </div>
    )
}
