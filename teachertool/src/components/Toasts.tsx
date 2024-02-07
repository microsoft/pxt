import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppStateContext } from "../state/appStateContext";
import { AnimatePresence, motion } from "framer-motion";
import { ToastType, ToastWithId } from "../types";
import * as Actions from "../state/actions";

const backgroundColors: { [type in ToastType]: string } = {
    success: "tw-bg-green-300",
    info: "tw-bg-sky-300",
    warning: "tw-bg-amber-300",
    error: "tw-bg-red-300",
};

const sliderColors: { [type in ToastType]: string } = {
    success: "tw-bg-green-500",
    info: "tw-bg-sky-500",
    warning: "tw-bg-amber-500",
    error: "tw-bg-red-500",
};

const icons: { [type in ToastType]: string } = {
    success: "😊",
    info: "🔔",
    warning: "😮",
    error: "😢",
};

// We need to delay the slider animation until the notification
// intro animation finishes, otherwise they can interfere.
const SLIDER_DELAY_MS = 300;

interface ToastNotificationProps {
    toast: ToastWithId;
}
const ToastNotification: React.FC<ToastNotificationProps> = ({ toast }) => {
    const { dispatch } = useContext(AppStateContext);
    const [sliderActive, setSliderActive] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
        if (toast.timeoutMs) {
            t1 = setTimeout(
                () => dispatch(Actions.dismissToast(toast.id)),
                SLIDER_DELAY_MS + toast.timeoutMs
            );
            t2 = setTimeout(() => setSliderActive(true), SLIDER_DELAY_MS);
        }
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [dispatch, toast.id, toast.timeoutMs]);

    const handleDismissClicked = () => {
        dispatch(Actions.dismissToast(toast.id));
    };

    const sliderWidth = useCallback(() => {
        return sliderActive ? "tw-w-0" : "tw-w-full";
    }, [sliderActive]);

    return (
        <div
            className={
                `tw-flex tw-flex-col tw-mr-0 md:tw-mr-4 tw-border-none tw-rounded
                tw-shadow-md tw-overflow-hidden tw-pointer-events-none ` +
                [
                    toast.textColorClass || "text-black",
                    toast.backgroundColorClass || backgroundColors[toast.type],
                ].join(" ")
            }
        >
            <div className={"tw-flex tw-gap-2 tw-p-3 tw-text-lg"}>
                {!toast.hideIcon && (
                    <div
                        className={
                            "tw-flex tw-items-center tw-justify-center tw-border-0 tw-rounded-full tw-w-7 tw-h-7 " +
                            sliderColors[toast.type]
                        }
                    >
                        {toast.icon ?? icons[toast.type]}
                    </div>
                )}
                <div className="tw-flex tw-flex-col tw-text-left">
                    {toast.text && (
                        <div className="tw-whitespace-nowrap tw-text-md tw-overflow-ellipsis">
                            {toast.text}
                        </div>
                    )}
                    {toast.detail && (
                        <div className="tw-text-sm">{toast.detail}</div>
                    )}
                    {toast.jsx && <div>{toast.jsx}</div>}
                </div>
                {!toast.hideDismissBtn && !toast.showSpinner && (
                    <div
                        className="tw-flex tw-flex-grow tw-justify-end tw-pointer-events-auto"
                        onClick={handleDismissClicked}
                    >
                        <div className="fas fa-times-circle">
                            {/* <FontAwesomeIcon
                                className={
                                    "tw-cursor-pointer hover:tw-scale-125 tw-transition-all"
                                }
                                icon={faTimesCircle}
                            /> */}
                        </div>
                    </div>
                )}
                {toast.showSpinner && (
                    <div className="tw-flex tw-flex-grow tw-justify-end">
                        <div className="fas fa-circle-notch fa-spin">
                            {/* <FontAwesomeIcon
                                icon={faCircleNotch}
                                className="fa-spin"
                            /> */}
                        </div>
                    </div>
                )}
            </div>
            {toast.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={
                            "tw-h-1 tw-transition-all tw-ease-linear " +
                            [sliderWidth(), sliderColors[toast.type]].join(" ")
                        }
                        style={{ transitionDuration: `${toast.timeoutMs}ms` }}
                    ></div>
                </div>
            )}
        </div>
    );
}

interface IProps {}
export const Toasts: React.FC<IProps> = ({}) => {
    const { state: teacherTool, dispatch } = useContext(AppStateContext);

    return (
        <div className="notification-container">
            <AnimatePresence>
                {teacherTool.toasts.map(item => (
                    <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        {/* <div key={i} className="notification-contents" /> */}
                        <ToastNotification toast={item} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
