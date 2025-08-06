import css from "./Toaster.module.scss";
import { useCallback, useEffect, useState, useRef } from "react";
import { classList } from "react-common/components/util";
import { AnimatePresence, motion } from "framer-motion";
import { ToastWithId, ToastType, Toast } from "./types";
import { makeToast } from "./utils";

const icons: { [type in ToastType]: string } = {
    success: "🎉",
    info: "🧐",
    warning: "🫨",
    error: "😢",
};

const SLIDER_DELAY_MS = 300;

// Event system for toast management
type ToastEvent = {
    type: 'ADD' | 'REMOVE' | 'CLEAR';
    payload?: ToastWithId | string;
};

class ToastEventEmitter extends EventTarget {
    addToast(toast: Toast): string {
        const toastWithId = makeToast(toast);
        const event = new CustomEvent('toast', {
            detail: { type: 'ADD', payload: toastWithId } as ToastEvent
        });
        this.dispatchEvent(event);
        return toastWithId.id;
    }

    removeToast(toastId: string): void {
        const event = new CustomEvent('toast', {
            detail: { type: 'REMOVE', payload: toastId } as ToastEvent
        });
        this.dispatchEvent(event);
    }

    clearAllToasts(): void {
        const event = new CustomEvent('toast', {
            detail: { type: 'CLEAR' } as ToastEvent
        });
        this.dispatchEvent(event);
    }
}

// Global instance for external use
const toastEmitter = new ToastEventEmitter();

// Export functions for external use
export const addToast = (toast: Toast): string => toastEmitter.addToast(toast);
export const removeToast = (toastId: string): void => toastEmitter.removeToast(toastId);
export const clearAllToasts = (): void => toastEmitter.clearAllToasts();

interface IToastNotificationProps {
    toast: ToastWithId;
}

const ToastNotification: React.FC<IToastNotificationProps> = ({ toast }) => {
    const [sliderActive, setSliderActive] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let t1: number, t2: number;
        if (toast.timeoutMs) {
            t1 = window.setTimeout(() => removeToast(toast.id), SLIDER_DELAY_MS + toast.timeoutMs);
            t2 = window.setTimeout(() => setSliderActive(true), SLIDER_DELAY_MS);
        }
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [toast.id, toast.timeoutMs]);

    const handleDismissClicked = () => {
        removeToast(toast.id);
    };

    const sliderWidth = useCallback(() => {
        return sliderActive ? "0%" : "100%";
    }, [sliderActive]);

    return (
        <div className={classList(css["toast"], css[toast.type], toast.className)}>
            <div className={css["toast-content"]}>
                {!toast.hideIcon && (
                    <div className={classList(css["icon-container"], css[toast.type])}>
                        {toast.icon ?? icons[toast.type]}
                    </div>
                )}
                {toast.iconJsx && (
                    <div className={classList(css["icon-container"], css[toast.type])}>{toast.iconJsx}</div>
                )}
                <div className={css["text-container"]}>
                    {toast.text && <div className={classList(css["text"], "tt-toast-text")}>{toast.text}</div>}
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
            {!!toast.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={classList(css["slider"], css[toast.type])}
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
    const [toasts, setToasts] = useState<ToastWithId[]>([]);

    useEffect(() => {
        const handleToastEvent = (event: Event) => {
            const customEvent = event as CustomEvent<ToastEvent>;
            const { type, payload } = customEvent.detail;

            switch (type) {
                case 'ADD':
                    if (payload && typeof payload === 'object') {
                        setToasts(prev => [...prev, payload as ToastWithId]);
                    }
                    break;
                case 'REMOVE':
                    if (typeof payload === 'string') {
                        setToasts(prev => prev.filter(toast => toast.id !== payload));
                    }
                    break;
                case 'CLEAR':
                    setToasts([]);
                    break;
            }
        };

        toastEmitter.addEventListener('toast', handleToastEvent);
        return () => {
            toastEmitter.removeEventListener('toast', handleToastEvent);
        };
    }, []);

    return (
        <div className={classList(css["toast-container"])}>
            <AnimatePresence>
                {toasts.map((item: ToastWithId) => (
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