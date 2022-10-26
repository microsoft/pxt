import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const copyTimeoutMs = 1000;

    const copyJoinCode = async () => {
        pxt.tickEvent("mp.copyjoincode");
        if (state.gameState?.joinCode) {
            navigator.clipboard.writeText(state.gameState?.joinCode);
            setCopySuccessful(true);
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
        <div className="tw-justify-self-center">
            {state.gameState?.joinCode && (
                <div>
                    {lf("Join Code: {0}", state.gameState?.joinCode)}
                    <button onClick={copyJoinCode} title={lf("Copy Join Code")}>
                        <div className="tw-text-sm tw-ml-1">
                            {!copySuccessful && (
                                <FontAwesomeIcon
                                    icon={faCopy}
                                    className="hover:tw-scale-105 tw-mb-[0.1rem]"
                                />
                            )}
                            {copySuccessful && (
                                <FontAwesomeIcon
                                    icon={faCheck}
                                    className="tw-text-green-600 tw-mb-[0.1rem]"
                                />
                            )}
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
