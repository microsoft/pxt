/// <reference path="../types.d.ts" />

import * as React from "react";
import { Checkbox } from "../controls/Checkbox";
import { Button } from "../controls/Button";
import { Link } from "../controls/Link";
import { Modal } from "../controls/Modal";

export interface SignInModalProps {
    onSignIn: (provider: pxt.AppCloudProvider, rememberMe: boolean) => Promise<void>;
    onClose: () => void;
    appMessage?: string;
    resolvePath?: (path: string) => string;
    mode?: "signin" | "signup";
}

export const SignInModal = (props: SignInModalProps) => {
    const { onSignIn, onClose, appMessage } = props;
    const resolvePath = props.resolvePath ?? (path => path);

    const [rememberMe, setRememberMe] = React.useState(false);
    const [mode, setMode] = React.useState(props.mode ?? "signin");

    const titleText = React.useMemo(() => (mode === "signin" ? lf("Sign in") : lf("Sign up")), [mode]);
    const headerText = React.useMemo(
        () =>
            mode === "signin"
                ? lf("Sign in to save your progress and access your work anytime, anywhere.")
                : lf("Join now to save your progress and access your work anytime, anywhere."),
        [mode]
    );
    const footerFragment = React.useMemo(
        () =>
            mode === "signin" ? (
                <div className='switch'>
                    <span>{lf("Don't have an account?")}</span>
                    <Button className="link-button" onClick={() => setMode("signup")} title={lf("Sign up")}/>
                </div>
            ) : (
                <div className='switch'>
                    <span>{lf("Have an account?")}</span>
                    <Button className="link-button" onClick={() => setMode("signin")} title={lf("Sign in")}/>
                </div>
            ),
        [mode]
    );

    return (
        <Modal title={titleText} onClose={onClose}>
            <div className='signin-form'>
                <div className='signin-header'>
                    {appMessage ? appMessage : undefined} {headerText}
                </div>
                <div className='signin-body'>
                    <div className='providers'>
                        {pxt.auth.identityProviders().map((provider, index) => {
                            const title =
                                mode === "signin"
                                    ? lf("Continue with {0}", provider.name)
                                    : lf("Sign up with {0}", provider.name);
                            return (
                                <Button
                                    key={index}
                                    className='teal inverted provider'
                                    onClick={() => onSignIn(provider, rememberMe)}
                                    title={title}
                                    ariaLabel={title}
                                    label={
                                        <div className='label'>
                                            <div>
                                                <img className='logo' src={resolvePath(provider.icon)} />
                                            </div>
                                            <div className='title'>{title}</div>
                                        </div>
                                    }
                                />
                            );
                        })}
                        <div className='rememberme'>
                            <Checkbox
                                id='rememberme'
                                label={lf("Remember me")}
                                isChecked={rememberMe}
                                onChange={setRememberMe}
                            ></Checkbox>
                        </div>
                    </div>
                </div>
                <div className='signin-footer'>
                    {footerFragment}
                    <div className='learn'>
                        <Link href='/identity/sign-in' target='_blank'>
                            {lf("Learn more")}
                        </Link>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
