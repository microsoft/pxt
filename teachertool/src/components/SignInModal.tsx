import { useContext, useState } from "react";
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
