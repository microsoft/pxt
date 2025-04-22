import * as React from "react";
import * as ReactDOM from "react-dom";

export interface NotificationOptions {
    kind?: string;
    text?: string;
    hc?: boolean;
}

export interface NotificationState {
    notifications?: pxt.Map<NotificationOptions>;
}

export interface NotificationProps {
}

export class Notification extends React.Component<NotificationProps, NotificationState> {

    constructor(props?: NotificationProps) {
        super(props);
        this.state = {
            notifications: {}
        }
    }

    push(notification: NotificationOptions) {
        const notifications = this.state.notifications;
        const id = ts.pxtc.Util.guidGen();
        Object.keys(notifications).filter(e => notifications[e].kind == notification.kind)
            .forEach(previousNotification => this.remove(previousNotification));
        notifications[id] = notification;
        const that = this;
        // Show for 3 seconds before removing
        setTimeout(() => {
            that.remove(id);
        }, 3000);

        this.setState({ notifications: notifications });
    }

    remove(id: string) {
        const notifications = this.state.notifications;
        if (notifications[id]) {
            delete notifications[id];
            this.setState({ notifications: notifications });
        }
    }

    render() {
        const { notifications } = this.state;

        function renderNotification(id: string, notification: NotificationOptions) {
            const { kind, text, hc } = notification;
            let cls = 'ignored info message';
            switch (kind) {
                case 'err': cls = 'red inverted segment'; break;
                case 'warn': cls = 'orange inverted segment'; break;
                case 'info': cls = 'blue inverted segment'; break;
                case 'compile': cls = 'ignored info message'; break;
            }
            return <div key={`${id}`} id={`${kind}msg`} className={`ui ${hc} ${cls}`}>{text}</div>
        }

        return <div id="msg" aria-live="polite">
            {Object.keys(notifications).map(k => renderNotification(k, notifications[k]))}
        </div>;
    }
}

let notificationsInitialized = false;
let notificationMessages: Notification;

export function pushNotificationMessage(options: NotificationOptions): void {
    if (!notificationsInitialized) {
        notificationsInitialized = true;
        const wrapper = document.body.appendChild(document.createElement('div'));
        notificationMessages = ReactDOM.render(React.createElement(Notification, options), wrapper);
        notificationMessages.push(options);
    } else if (notificationMessages) {
        notificationMessages.push(options);
    }
}
