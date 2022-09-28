import { useCallback, useContext, useMemo, useState } from "react"
import { AppStateContext } from "../state/Context"
import { SignInModal } from "../../../react-common/components/profile/SignInModal"
import { Button } from "../../../react-common/components/controls/Button"
import * as authClient from "../services/authClient"

// eslint-disable-next-line import/no-unassigned-import
import "../App.css"
// eslint-disable-next-line import/no-unassigned-import
import "../arcade.css"

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext)
    const [showSignInModal, setShowSignInModal] = useState(false)
    const { signedIn } = state

    const handleSignInClick = useCallback(async () => {
        setShowSignInModal(true)
    }, [signedIn, setShowSignInModal])

    const authButtonLabel = lf("Sign In")

    return (
        <div className="app-content">
            <Button
                className='auth-button primary'
                label={authButtonLabel}
                title={authButtonLabel}
                onClick={handleSignInClick}
            />
            {showSignInModal && (
                <SignInModal
                    onClose={() => setShowSignInModal(false)}
                    onSignIn={async (provider, rememberMe) => {
                        authClient.loginAsync(provider.id, rememberMe)
                    }}
                />
            )}
        </div>
    )
}
