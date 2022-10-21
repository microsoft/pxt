import { useContext, useEffect, useMemo } from "react";
import { AppStateContext } from "./state/AppStateContext";
import Loading from "./components/Loading";
import SignInPage from "./components/SignInPage";
import SignedInPage from "./components/SignedInPage";
import HeaderBar from "./components/HeaderBar";
import Toast from "./components/Toast";
import AppModal from "./components/AppModal";
import * as authClient from "./services/authClient";

// eslint-disable-next-line import/no-unassigned-import
import "./App.css";

function App() {
    const { state } = useContext(AppStateContext);
    const { signedIn, appMode } = state;
    const { uiMode } = appMode;
    const targetTheme = pxt?.appTarget?.appTheme;

    const loading = useMemo(() => uiMode === "init", [uiMode]);

    useEffect(() => {
        // On mount, check if user is signed in
        authClient
            .authCheckAsync()
            .then(() => {})
            .catch(() => {});
    }, []);

    return (
        <div className={`${pxt.appTarget.id} tw-flex tw-flex-col`}>
            {loading && <Loading />}
            {!loading && <HeaderBar />}
            {!loading && !signedIn && <SignInPage />}
            {!loading && signedIn && <SignedInPage />}
            <AppModal />
            <Toast />
            <div className="tw-flex-grow"/>

            {/* Footer */}
            {targetTheme?.organizationUrl || targetTheme?.organizationUrl || targetTheme?.privacyUrl || targetTheme?.copyrightText ? <div className="ui horizontal small divided link list tw-text-center" role="contentinfo">
                {targetTheme.organizationUrl && targetTheme.organization ? <a className="item !tw-text-black" target="_blank" rel="noopener noreferrer" href={targetTheme.organizationUrl}>{targetTheme.organization}</a> : undefined}
                {targetTheme.termsOfUseUrl ? <a target="_blank" className="item !tw-text-black" href={targetTheme.termsOfUseUrl} rel="noopener noreferrer">{lf("Terms of Use")}</a> : undefined}
                {targetTheme.privacyUrl ? <a target="_blank" className="item !tw-text-black" href={targetTheme.privacyUrl} rel="noopener noreferrer">{lf("Privacy")}</a> : undefined}
                {targetTheme.copyrightText ? <div className="ui item copyright !tw-text-black">{targetTheme.copyrightText}</div> : undefined}
            </div> : undefined}
        </div>
    );
}

export default App;
