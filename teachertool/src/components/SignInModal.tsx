import { useContext } from "react";
import { AppStateContext } from "../state/appStateContext";
import { SignInModal as RCSignInModal } from "react-common/components/profile/SignInModal";
import { hideModal } from "../transforms/hideModal";
import * as authClient from "../services/authClient";

export interface IProps {}
export const SignInModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    // Preserve URL hash and query parameters through the reload triggered by sign-in.
    const callbackState: pxt.auth.CallbackState = {
        hash: window.location.hash,
        params: pxt.Util.parseQueryString(window.location.href),
    }

    return teacherTool.modalOptions?.modal === "sign-in" ? (
        <RCSignInModal
            onClose={hideModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe, callbackState);
                // modal will hide when the user profile is set after loginAsync completes.
            }}
            dialogMessages={{
                signInMessage: lf("Sign in to use MakeCode Code Evaluation."),
                signUpMessage: lf("Sign up to use MakeCode Code Evaluation."),
            }}
            hideDismissButton={true}
        />
    ) : null;
};
