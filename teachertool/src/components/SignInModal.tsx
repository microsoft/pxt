import { useContext, } from "react";
import { AppStateContext } from "../state/appStateContext";
import { SignInModal as RCSignInModal } from "react-common/components/profile/SignInModal";
import { hideModal } from "../transforms/hideModal";
import * as authClient from "../services/authClient";
import { Strings } from "../constants";

export interface IProps {}
export const SignInModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    return teacherTool.modalOptions?.modal === "sign-in" ? (
        <RCSignInModal
            onClose={hideModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe);
                // modal will hide when the user profile is set after loginAsync completes.
            }}
            dialogMessages={{
                signInMessage: lf("Sign in to use {0}.", Strings.ToolName),
                signUpMessage: lf("Sign up to use {0}.", Strings.ToolName),
            }}
            hideDismissButton={true}
        />
    ) : null;
};
