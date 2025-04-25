import css from "./Toaster.module.scss";
import { useCallback, useContext, useEffect, useState, useRef } from "react";
import { AppStateContext } from "@/state/Context";
import { AnimatePresence, motion } from "framer-motion";
import { dismissToast } from "@/state/actions";
import { classlist } from "@/utils";
import { ToastWithId, ToastType } from "./types";

const icons: { [type in ToastType]: string } = {
    success: "🎉",
    info: "🧐",
    warning: "🫨",
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
        <div className={classlist(css["toast"], css[toast.type], toast.className)}>
            <div className={css["toast-content"]}>
                {!toast.hideIcon && (
                    <div className={classlist(css["icon-container"], css[toast.type])}>
                        {toast.icon ?? icons[toast.type]}
                    </div>
                )}
                {toast.iconJsx && (
                    <div className={classlist(css["icon-container"], css[toast.type])}>{toast.iconJsx}</div>
                )}
                <div className={css["text-container"]}>
                    {toast.text && <div className={classlist(css["text"], "tt-toast-text")}>{toast.text}</div>}
                    {toast.detail && <div className={css["detail"]}>{toast.detail}</div>}
                    {toast.jsx && <div>{toast.jsx}</div>}
                </div>
                {!toast.hideDismissBtn && !toast.showSpinner && (
                    <div className={css["dismiss-btn"]} onClick={handleDismissClicked}>
                        <i className={classlist("far fa-times-circle", css["icon"])} />
                    </div>
                )}
                {toast.showSpinner && (
                    <div className={css["spinner"]}>
                        <i className="fas fa-circle-notch fa-spin" />
                    </div>
                )}
            </div>
            {!!toast.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={classlist(css["slider"], css[toast.type])}
                        style={{
                            width: sliderWidth(),
                            transitionDuration: `${toast.timeoutMs}ms`,
                        }}
                    ></div>
                </div>
            )}
        </div>
    );
};

export function Toaster() {
    const { state } = useContext(AppStateContext);

    return (
        <div className={classlist(css["toast-container"])}>
            <AnimatePresence>
                {state.toasts.map(item => (
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
}
