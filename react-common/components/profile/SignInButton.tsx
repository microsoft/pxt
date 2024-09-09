import * as React from "react";
import { Button } from "../controls/Button";
import { classList } from "../util";

interface IProps {
    onSignInClick: () => void;
    className?: string;
}

export const SignInButton: React.FC<IProps> = ({ onSignInClick, className }) => {
    return (
        <Button
            className={classList(className, "sign-in-button")}
            rightIcon="xicon cloud-user large"
            title={lf("Sign In")}
            label={lf("Sign In")}
            onClick={onSignInClick}
        />
    );
};