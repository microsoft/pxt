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
    success: "bg-green-300",
    info: "bg-sky-300",
    warning: "bg-amber-300",
    error: "bg-red-300",
};

const sliderColors: { [type in ToastType]: string } = {
    success: "bg-green-500",
    info: "bg-sky-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
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
            t1 = setTimeout(
                () => dispatch(dismissToast(props.id)),
                SLIDER_DELAY_MS + props.timeoutMs
            );
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
        return sliderActive ? "w-0" : "w-full";
    }, [sliderActive]);

    return (
        <div
            className={
                "flex flex-col mr-0 md:mr-4 border-none rounded shadow-md overflow-hidden pointer-events-auto " +
                [
                    props.textColorClass || "text-black",
                    props.backgroundColorClass || backgroundColors[props.type],
                ].join(" ")
            }
        >
            <div className={"flex gap-2 p-3 text-lg"}>
                {!props.hideIcon && (
                    <div
                        className={
                            "flex justify-center border-0 rounded-full " +
                            sliderColors[props.type]
                        }
                    >
                        {icons[props.type]}
                    </div>
                )}
                <div className="flex flex-col text-left">
                    {props.text && (
                        <div className="whitespace-nowrap text-md overflow-ellipsis">
                            {props.text}
                        </div>
                    )}
                    {props.detail && (
                        <div className="text-sm">{props.detail}</div>
                    )}
                    {props.jsx && <div>{props.jsx}</div>}
                </div>
                {!props.hideDismissBtn && !props.showSpinner && (
                    <div
                        className="flex flex-grow justify-end"
                        onClick={handleDismissClicked}
                    >
                        <div>
                            <FontAwesomeIcon
                                className={
                                    "cursor-pointer hover:scale-125 transition-all"
                                }
                                icon={faTimesCircle}
                            />
                        </div>
                    </div>
                )}
                {props.showSpinner && (
                    <div className="flex flex-grow justify-end">
                        <div>
                            <FontAwesomeIcon
                                icon={faCircleNotch}
                                className="fa-spin"
                            />
                        </div>
                    </div>
                )}
            </div>
            {props.timeoutMs && (
                <div>
                    <div
                        ref={sliderRef}
                        className={
                            "h-1 transition-all ease-linear " +
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
        <div className="flex gap-2 flex-col-reverse items-end fixed bottom-0 right-0 mb-8 mr-4 z-50 pointer-events-none">
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
