import { useContext, useState } from "react";
import { Textarea } from "react-common/components/controls/Textarea";
import { SignInModal } from "react-common/components/profile/SignInModal";
import {
    signInAsync,
    kickPlayer,
    leaveGameAsync,
    sendAbuseReportAsync,
} from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import ConfirmModal from "./modals/ConfirmModal";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { deepLinks, clientRole, gameState } = state;
    const { gameId: shareCode } = gameState ?? {};
    const [textValue, setTextValue] = useState("");

    switch (state.modal) {
        case "sign-in":
            return (
                <SignInModal
                    onClose={() => dispatch(clearModal())}
                    onSignIn={async (provider, rememberMe) => {
                        const params: pxt.Map<string> = {};
                        if (deepLinks?.shareCode)
                            params["host"] = deepLinks.shareCode;
                        if (deepLinks?.joinCode)
                            params["join"] = deepLinks.joinCode;
                        await signInAsync(provider.id, rememberMe, { params });
                    }}
                    dialogMessages={state.modalOpts.dialogMessages}
                    hideDismissButton={true}
                />
            );
        case "report-abuse":
            return (
                <ConfirmModal
                    title={lf("Report Abuse")}
                    confirmLabel={lf("Submit Report")}
                    onConfirm={async () => {
                        dispatch(clearModal());
                        await sendAbuseReportAsync(shareCode!, textValue);
                    }}
                    onCancel={() => dispatch(clearModal())}
                >
                    <div className="tw-flex tw-flex-col tw-gap-4">
                        <div>{lf("Why do you find it offensive?")}</div>
                        <div>
                            <Textarea onChange={setTextValue}></Textarea>
                        </div>
                    </div>
                </ConfirmModal>
            );
        case "kick-player":
            return (
                <ConfirmModal
                    title={lf("Kick Player")}
                    onConfirm={() => {
                        dispatch(clearModal());
                        kickPlayer(state.modalOpts.clientId);
                    }}
                    onCancel={() => dispatch(clearModal())}
                >
                    <div>
                        {lf(
                            "Kick this player? They will be blocked from rejoining the game."
                        )}
                    </div>
                </ConfirmModal>
            );
        case "leave-game":
            if (clientRole === "host") {
                return (
                    <ConfirmModal
                        title={lf("End the Game")}
                        onConfirm={async () => {
                            dispatch(clearModal());
                            await leaveGameAsync("ended");
                        }}
                        onCancel={() => dispatch(clearModal())}
                    >
                        <div>
                            {lf(
                                "End the game? All players will be disconnected."
                            )}
                        </div>
                    </ConfirmModal>
                );
            } else {
                return (
                    <ConfirmModal
                        title={lf("Leave Game")}
                        onConfirm={async () => {
                            dispatch(clearModal());
                            await leaveGameAsync("left");
                        }}
                        onCancel={() => dispatch(clearModal())}
                    >
                        <div>{lf("Leave the game?")}</div>
                    </ConfirmModal>
                );
            }
        default:
            return null;
    }
}
