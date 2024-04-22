import { useCallback, useContext, useEffect, useState, useRef } from "react";
import { AppStateContext } from "../state/appStateContext";
import { ToastType, ToastWithId } from "../types";
import { AnimatePresence, motion } from "framer-motion";
import { dismissToast } from "../state/actions";
import { classList } from "react-common/components/util";
import css from "./styling/Toasts.module.scss";

const icons: { [type in ToastType]: string } = {
    success: "😊",
    info: "🔔",
    warning: "😮",
    error: "😢",
};

const SLIDER_DELAY_MS = 300;

interface IToastNotificationProps {
    toast: ToastWithId;
}
const ToastNotification: React.FC<IToastNotificationProps> = ({ toast }) => {
    const { dispatch } = useContext(AppStateContext);
    const [sliderActive, setSliderActive] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
        if (toast.timeoutMs) {
            t1 = setTimeout(() => dispatch(dismissToast(toast.id)), SLIDER_DELAY_MS + toast.timeoutMs);
            t2 = setTimeout(() => setSliderActive(true), SLIDER_DELAY_MS);
        }
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [dispatch, toast.id, toast.timeoutMs]);

    const handleDismissClicked = () => {
        dispatch(dismissToast(toast.id));
    };

    const sliderWidth = useCallback(() => {
        return sliderActive ? "0%" : "100%";
    }, [sliderActive]);

    return (
        <div className={classList(css["toast"], css[toast.type], toast.className)} aria-live="assertive">
            <div className={css["toast-content"]}>
                {!toast.hideIcon && (
                    <div className={classList(css["icon-container"], css[toast.type])}>
                        {toast.icon ?? icons[toast.type]}
                    </div>
                )}
                <div className={css["text-container"]}>
                    {toast.text && <div className={classList(css["text"], "tt-toast-text")} >{toast.text}</div>}
                    {toast.detail && <div className={css["detail"]}>{toast.detail}</div>}
                    {toast.jsx && <div>{toast.jsx}</div>}
                </div>
                {!toast.hideDismissBtn && !toast.showSpinner && (
                    <div className={css["dismiss-btn"]} onClick={handleDismissClicked}>
                        <i className={classList("far fa-times-circle", css["icon"])} />
                    </div>
                )}
                {toast.showSpinner && (
                    <div className={css["spinner"]}>
                        <i className="fas fa-circle-notch fa-spin" />
                    </div>
                )}
            </div>
            {toast.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={classList(css["slider"], css[toast.type])}
                        style={{ width: sliderWidth(), transitionDuration: `${toast.timeoutMs}ms` }}
                    ></div>
                </div>
            )}
        </div>
    );
};

interface IProps {}
export const Toasts: React.FC<IProps> = ({}) => {
    const { state: teacherTool } = useContext(AppStateContext);

    return (
        <div className={classList(css["toast-container"])}>
            <AnimatePresence>
                {teacherTool.toasts.map(item => (
                    <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <ToastNotification toast={item} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
