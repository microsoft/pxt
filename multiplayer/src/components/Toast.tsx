import { useCallback, useContext, useEffect, useState, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { ToastType, ToastWithId } from "../types";
import { faTimesCircle } from "@fortawesome/free-regular-svg-icons";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { AnimatePresence, motion } from "framer-motion";
import { dismissToast } from "../state/actions";

// eslint-disable-next-line import/no-unassigned-import
import "../App.css";

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

function Toast(props: ToastWithId) {
    const { dispatch } = useContext(AppStateContext);
    const [sliderActive, setSliderActive] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
        if (props.timeoutMs) {
            t1 = setTimeout(() => dispatch(dismissToast(props.id)), SLIDER_DELAY_MS + props.timeoutMs);
            t2 = setTimeout(() => setSliderActive(true), SLIDER_DELAY_MS);
        }
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [dispatch, props.id, props.timeoutMs]);

    const handleDismissClicked = () => {
        dispatch(dismissToast(props.id));
    };

    const sliderWidth = useCallback(() => {
        return sliderActive ? "tw-w-0" : "tw-w-full";
    }, [sliderActive]);

    return (
        <div
            className={
                `tw-flex tw-flex-col tw-mr-0 md:tw-mr-4 tw-border-none tw-rounded
                tw-shadow-md tw-overflow-hidden tw-pointer-events-none ` +
                [props.textColorClass || "text-black", props.backgroundColorClass || backgroundColors[props.type]].join(
                    " "
                )
            }
        >
            <div className={"tw-flex tw-gap-2 tw-p-3 tw-text-lg"}>
                {!props.hideIcon && (
                    <div
                        className={
                            "tw-flex tw-items-center tw-justify-center tw-border-0 tw-rounded-full tw-w-7 tw-h-7 " +
                            sliderColors[props.type]
                        }
                    >
                        {props.icon ?? icons[props.type]}
                    </div>
                )}
                <div className="tw-flex tw-flex-col tw-text-left">
                    {props.text && (
                        <div className="tw-whitespace-nowrap tw-text-md tw-overflow-ellipsis">{props.text}</div>
                    )}
                    {props.detail && <div className="tw-text-sm">{props.detail}</div>}
                    {props.jsx && <div>{props.jsx}</div>}
                </div>
                {!props.hideDismissBtn && !props.showSpinner && (
                    <div
                        className="tw-flex tw-flex-grow tw-justify-end tw-pointer-events-auto"
                        onClick={handleDismissClicked}
                    >
                        <div>
                            <FontAwesomeIcon
                                className={"tw-cursor-pointer hover:tw-scale-125 tw-transition-all"}
                                icon={faTimesCircle}
                            />
                        </div>
                    </div>
                )}
                {props.showSpinner && (
                    <div className="tw-flex tw-flex-grow tw-justify-end">
                        <div>
                            <FontAwesomeIcon icon={faCircleNotch} className="fa-spin" />
                        </div>
                    </div>
                )}
            </div>
            {props.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={
                            "tw-h-1 tw-transition-all tw-ease-linear " +
                            [sliderWidth(), sliderColors[props.type]].join(" ")
                        }
                        style={{ transitionDuration: `${props.timeoutMs}ms` }}
                    ></div>
                </div>
            )}
        </div>
    );
}

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { toasts } = state;

    return (
        <div className="tw-flex tw-gap-2 tw-flex-col-reverse tw-items-end tw-fixed tw-bottom-0 tw-right-0 tw-mb-8 tw-mr-4 tw-z-50 tw-pointer-events-none">
            <AnimatePresence>
                {toasts.map(item => (
                    <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                        <Toast {...item} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
