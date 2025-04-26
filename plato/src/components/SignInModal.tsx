import css from "./SignInModal.module.scss";
import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { SignInModal as RCSignInModal } from "react-common/components/profile/SignInModal";
import { dismissModal } from "@/transforms/dismissModal";
import * as authClient from "@/services/authClient";
import { Strings } from "@/constants";

export function SignInModal() {
    const { state } = useContext(AppStateContext);

    return state.modalOptions?.type === "sign-in" ? (
        <RCSignInModal
            className={css["sign-in-modal"]}
            onClose={dismissModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe);
                // modal will hide when the user profile is set after loginAsync completes.
            }}
            dialogMessages={{
                signInMessage: Strings.SignInMessage,
                signUpMessage: Strings.SignUpMessage,
            }}
            titles={{
                signInTitle: (
                    <>
                        <span className={css["title"]}>{Strings.SignIn}</span>
                    </>
                ),
                signUpTitle: (
                    <>
                        <span className={css["title"]}>{Strings.SignUp}</span>
                    </>
                ),
            }}
            hideDismissButton={true}
        />
    ) : null;
}
