import { useContext, useMemo } from "react";
import { AppStateContext } from "../state/AppStateContext";

export function useAuthDialogMessages(): {
    signInMessage: string;
    signUpMessage: string;
} {
    const { state } = useContext(AppStateContext);
    const { deepLinks } = state;
    const { shareCode, joinCode } = deepLinks;

    const dialogMessages = useMemo(() => {
        if (shareCode) {
            return {
                signInMessage: lf(
                    "Sign in to host multiplayer game {0}",
                    shareCode
                ),
                signUpMessage: lf(
                    "Sign up to host multiplayer game {0}",
                    shareCode
                ),
            };
        } else if (joinCode) {
            return {
                signInMessage: lf(
                    "Sign in to join multiplayer game {0}",
                    joinCode
                ),
                signUpMessage: lf(
                    "Sign up to join multiplayer game {0}",
                    joinCode
                ),
            };
        } else {
            return {
                signInMessage: lf("Sign in to host or join a multiplayer game"),
                signUpMessage: lf("Sign up to host or join a multiplayer game"),
            };
        }
    }, [shareCode, joinCode]);

    return dialogMessages;
}
