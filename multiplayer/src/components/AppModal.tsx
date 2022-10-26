import { useContext } from "react";
import { Modal } from "react-common/components/controls/Modal";
import { SignInModal } from "react-common/components/profile/SignInModal";
import { signInAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { deepLinks } = state;
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
        default:
            return null;
    }
}
