import * as React from "react";

interface OwnProps {

}

interface DispatchProps {

}

type CloudActionsProps = OwnProps & DispatchProps;


// VVN TODO Handle tablet view
export class CloudActionsImpl extends React.Component<CloudActionsProps> {
    render () {
        let isLoggedIn = true
        return <div className="cloud-action">
            {
                isLoggedIn
                ? <div className="cloud-indicator">
                    <div className={"ui tiny cloudicon xicon cloud-saved-b"} title={lf("Project saved to cloud")} tabIndex={-1}></div>
                    Saved To Cloud!
                </div>
                : <div className="sign-in-button">Sign in to Save</div>
            }
        </div>
    }
}