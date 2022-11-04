import { useContext } from "react";
import { Modal } from "react-common/components/controls/Modal";
import { SignInModal } from "react-common/components/profile/SignInModal";
import { signInAsync, kickPlayer, leaveGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";
import ConfirmModal from "./modals/ConfirmModal";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { deepLinks, clientRole } = state;
    const { shareCode, joinCode } = deepLinks;

    switch (state.modal) {
        case "sign-in":
            return (
                <SignInModal
                    onClose={() => dispatch(clearModal())}
                    onSignIn={async (provider, rememberMe) => {
                        const params: pxt.Map<string> = {};
                        if (shareCode) params["host"] = shareCode;
                        if (joinCode) params["join"] = joinCode;
                        await signInAsync(provider.id, rememberMe, { params });
                    }}
                    dialogMessages={state.modalOpts.dialogMessages}
                    hideDismissButton={true}
                />
            );
        case "report-abuse":
            return (
                <Modal
                    title={lf("Report Abuse")}
                    onClose={() => dispatch(clearModal())}
                >
                    Report Abuse Placeholder {/*TODO multiplayer*/}
                </Modal>
            );
        case "kick-player":
            return (
                <ConfirmModal
                    title={lf("Kick Player")}
                    message={lf("Kick this player? They will be blocked from rejoining the game.")}
                    onConfirm={() => {
                        dispatch(clearModal());
                        kickPlayer(state.modalOpts.clientId);
                    }}
                    onCancel={() => dispatch(clearModal())}
                />
            );
        case "leave-game":
            if (clientRole === "host") {
                return (
                    <ConfirmModal
                        title={lf("End the Game")}
                        message={lf("End this game? All players will be disconnected.")}
                        onConfirm={async () => {
                            dispatch(clearModal());
                            await leaveGameAsync("ended");
                        }}
                        onCancel={() => dispatch(clearModal())}
                    />
                );
            } else {
                return (
                    <ConfirmModal
                        title={lf("Leave Game")}
                        message={lf("Leave the game?")}
                        onConfirm={async () => {
                            dispatch(clearModal());
                            await leaveGameAsync("left");
                        }}
                        onCancel={() => dispatch(clearModal())}
                    />
                );
            }
        default:
            return null;
    }
}
