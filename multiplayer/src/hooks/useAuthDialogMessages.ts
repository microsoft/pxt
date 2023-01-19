import { useContext, useMemo } from "react";
import { AppStateContext } from "../state/AppStateContext";

export function useAuthDialogMessages(): {
    signInMessage: string;
    signUpMessage: string;
} {
    const { state } = useContext(AppStateContext);
    const { deepLinks } = state;
    const { shareCode, joinCode } = deepLinks;
    const hostSignIn = lf("Sign in to host this multiplayer game");
    const hostSignUp = lf("Sign up to host this multiplayer game");
    const joinSignIn = lf("Sign in to join multiplayer game {0}", joinCode);
    const joinSignUp = lf("Sign up to join multiplayer game {0}", joinCode);
    const eitherSignIn = lf("Sign in to host or join a multiplayer game");
    const eitherSignUp = lf("Sign up to host or join a multiplayer game");

    const dialogMessages = useMemo(() => {
        if (shareCode) {
            return {
                signInMessage: hostSignIn,
                signUpMessage: hostSignUp,
            };
        } else if (joinCode) {
            return {
                signInMessage: joinSignIn,
                signUpMessage: joinSignUp,
            };
        } else {
            return {
                signInMessage: eitherSignIn,
                signUpMessage: eitherSignUp,
            };
        }
    }, [shareCode, joinCode]);

    return dialogMessages;
}
