import * as React from "react";
import * as ReactDOM from "react-dom";
import * as sui from "./sui"
import * as codecard from "./codecard"
import * as data from "./data"

type ISettingsProps = pxt.editor.ISettingsProps;

const lf = pxt.Util.lf;

interface NotificationState {
}

export class NotificationDialog extends data.Component<ISettingsProps, NotificationState> {
    constructor(props: ISettingsProps) {
        super(props);
        this.state = {}
    }

    hide() {
        this.props.parent.setState({ notification: undefined })
    }

    readMore(notification: pxt.Notification) {
        if (!notification.readmore)
            return;
        this.hide()
        window.open(notification.readmore);
    }

    goToURL(notification: pxt.Notification) {
        if (!notification.url)
            return;
        this.hide()
        window.open(notification.url);
    }

    renderCore() {
        if (!this.props.parent.state.notification) return <div></div>;

        const notification = this.props.parent.state.notification;

        const header = notification.heading || lf("Notification");

        return (
            <sui.Modal open={!!notification} className={`notificationDialog ${notification.type}`} header={header} size="small"
                onClose={() => this.hide() } dimmer={true}
                closeIcon={true}
                >
                <div>
                    {notification.message}
                </div>
                <div className="ui segment inverted right aligned">
                    {notification.url ? <sui.Button
                        text={lf("Go to URL")}
                        class={`green`}
                        onClick={() => this.goToURL(notification)} /> : undefined }
                    <sui.Button
                        text={lf("Ok")}
                        onClick={() => this.hide()} />
                </div>
            </sui.Modal>
        );
    }
}
