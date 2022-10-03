import { useCallback, useContext, useMemo, useState, useEffect } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { signInAsync } from "../epics";
import { dismissToast, showToast } from "../state/actions";
import { SignInModal } from "../../../react-common/components/profile/SignInModal";
import { Button } from "../../../react-common/components/controls/Button";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const { signedIn } = state;

    const progressToast = useMemo(
        () =>
            showToast({
                type: "info",
                text: lf("Signing in..."),
                showSpinner: true,
            }),
        []
    );

    useEffect(() => {
        if (showSignInModal) {
            dispatch(progressToast);
        } else {
            dispatch(dismissToast(progressToast.toast.id));
        }
    }, [showSignInModal]);

    const handleSignInClick = useCallback(async () => {
        setShowSignInModal(true);
    }, [signedIn, setShowSignInModal]);

    return (
        <div className="pt-3 flex flex-col items-center gap-1">
            <Button
                className="primary"
                label={lf("Sign In")}
                title={lf("Sign In")}
                onClick={handleSignInClick}
            />
            {showSignInModal && (
                <SignInModal
                    onClose={() => setShowSignInModal(false)}
                    onSignIn={async (provider, rememberMe) => {
                        await signInAsync(provider.id, rememberMe);
                    }}
                />
            )}
        </div>
    );
}
