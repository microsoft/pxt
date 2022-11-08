import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";
import { showToast } from "../state/actions";
import { AppStateContext, dispatch } from "../state/AppStateContext";

export default function Render(props: {
    copyValue: string;
    title: string;
    eventName?: string;
    label?: JSX.Element | undefined;
    toastMessage?: string | undefined;
}) {
    const { state } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const copyTimeoutMs = 2500;

    const copyValue = async () => {
        if (props.eventName) pxt.tickEvent(props.eventName);
        if (state.gameState?.joinCode) {
            navigator.clipboard.writeText(props.copyValue);
            setCopySuccessful(true);
            if (props.toastMessage) {
                dispatch(showToast({
                type: "success",
                text: props.toastMessage,
                timeoutMs: 5000,
                }));
            }
        }
    };

    useEffect(() => {
        if (copySuccessful) {
            let resetCopyTimer = setTimeout(() => {
                setCopySuccessful(false);
            }, copyTimeoutMs);
            return () => {
                clearTimeout(resetCopyTimer);
            };
        }
    }, [copySuccessful]);

    return (
        <button
            onClick={copyValue}
            title={props.title}
            className="tw-flex tw-items-center"
        >
            {props.label && (
                <span className="tw-mr-1 hover:tw-opacity-80">
                    {props.label}
                </span>
            )}
            <span>
                {!copySuccessful && (
                    <FontAwesomeIcon
                        icon={faCopy}
                        className="hover:tw-scale-110 tw-ease-linear tw-duration-[50ms]"
                    />
                )}
                {copySuccessful && (
                    <FontAwesomeIcon
                        icon={faCheck}
                        className="tw-text-green-600"
                    />
                )}
            </span>
        </button>
    );
}
