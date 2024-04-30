import { SignInModal as CommonSignInModal } from "react-common/components/profile/SignInModal";
import { AppStateContext } from "../state/appStateContext";
import { useCallback, useContext } from "react";
import { hideModal } from "../state/actions";
import { loginAsync } from "../services/authClient";

export const SignInModal: React.FC = () => {
    const { state, dispatch } = useContext(AppStateContext);

    const onClose = useCallback(() => {
        dispatch(hideModal());
    }, []);

    const onSignIn = useCallback(async (provider: pxt.AppCloudProvider, rememberMe: boolean) => {
        loginAsync(provider.id, rememberMe);
    }, []);

    return (
        <>
        { state.modal?.modal === "signin" &&
            <CommonSignInModal
                onSignIn={onSignIn}
                onClose={onClose}
            />
        }
        </>
    );
};