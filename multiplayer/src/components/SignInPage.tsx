import { useCallback, useContext, useMemo, useState, useEffect } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { signInAsync } from "../epics";
import { dismissToast, showToast } from "../state/actions";
import { SignInModal } from "../../../react-common/components/profile/SignInModal";
import { Button } from "../../../react-common/components/controls/Button";

export interface SignInPageProps {
    handleSignIn: () => Promise<void>;
}

export default function Render(props: SignInPageProps) {
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

    return (
        <div className="tw-pt-3 tw-flex tw-flex-col tw-items-center tw-gap-1">
            <Button
                className="primary"
                label={lf("Sign In")}
                title={lf("Sign In")}
                onClick={props.handleSignIn}
            />
        </div>
    );
}
