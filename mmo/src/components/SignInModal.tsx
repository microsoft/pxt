import { useContext } from "react";
import { AppStateContext } from "@/state/Context";
import { SignInModal as RCSignInModal } from "react-common/components/profile/SignInModal";
import { dismissModal } from "@/transforms/dismissModal";
import * as authClient from "@/services/authClient";

export function SignInModal() {
    const { state } = useContext(AppStateContext);

    return state.modalOptions?.type === "sign-in" ? (
        <RCSignInModal
            onClose={dismissModal}
            onSignIn={async (provider, rememberMe) => {
                await authClient.loginAsync(provider.id, rememberMe);
                // modal will hide when the user profile is set after loginAsync completes.
            }}
            dialogMessages={{
                signInMessage: lf("Sign in to use MakeCode Arcade MMO."),
                signUpMessage: lf("Sign up to use MakeCode Arcade MMO."),
            }}
            hideDismissButton={true}
        />
    ) : null;
}
