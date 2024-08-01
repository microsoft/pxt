import { useContext, } from "react";
import { AppStateContext } from "../state/appStateContext";
import { SignInModal as RcSignInModal } from "react-common/components/profile/SignInModal";
import { hideModal } from "../transforms/hideModal";
import * as authClient from "../services/authClient";

export interface IProps {}
export const SignInModal: React.FC<IProps> = () => {
    const { state: teacherTool } = useContext(AppStateContext);

    return teacherTool.modalOptions?.modal === "sign-in" ? (
        <RcSignInModal
            onClose={hideModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe);
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
