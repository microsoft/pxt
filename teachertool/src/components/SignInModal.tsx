import { useContext, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { SignInModal as RcSignInModal } from "react-common/components/profile/SignInModal";
import { hideModal } from "../transforms/hideModal";
import * as authClient from "../services/authClient";
import { Modal } from "react-common/components/controls/Modal";
import { setUserProfile } from "../transforms/setUserProfile";
import { Button } from "react-common/components/controls/Button";

export interface IProps {}
export const SignInModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);
    const [showDebugOption, setShowDebugOption] = useState(pxt.BrowserUtils.isLocalHost());

    if (teacherTool.modalOptions?.modal === "sign-in" && showDebugOption) {
        function debugLogin() {
            setUserProfile({
                id: "debug_login",
                idp: {
                    username: "Debug Login",
                    displayName: "Debug Login",
                },
            });
            hideModal();
        }
        return (
            <Modal title={"Debug Login?"}>
                <div>
                    <Button onClick={debugLogin} title={"Debug Login"} label={"Debug Login"} className={"primary"} />
                    <Button onClick={() => setShowDebugOption(false)} title={"Cancel"} label={"Cancel"} />
                </div>
            </Modal>
        );
    }

    return teacherTool.modalOptions?.modal === "sign-in" ? (
        <RcSignInModal
            onClose={hideModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe);
                hideModal();
            }}
            dialogMessages={{
                signInMessage: lf("Sign in to use the MakeCode Code Checker."),
                signUpMessage: lf("Sign up to use the MakeCode Code Checker."),
            }}
            hideDismissButton={true}
        />
    ) : null;
};
