import { stateAndDispatch } from "../state";
import * as Actions from "../state/actions";

let initialize = () => {
    const updateOnce = () => {
        const { state, dispatch } = stateAndDispatch();

        const notifications = state.toasts.slice();
        notifications.forEach(notification => {
            if (notification.expiration - Date.now() < 0) {
                dispatch(Actions.removeNotification(notification.id));
            }
        });

        setTimeout(updateOnce, 250);
    };

    setTimeout(updateOnce, 1000);
};

export { initialize };
