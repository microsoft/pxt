import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const copyTimeoutMs = 2500;

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

    const joinCode = state.gameState?.joinCode;
    const displayJoinCode = joinCode?.slice(0, 3) + " " + joinCode?.slice(3);
    return joinCode ? (
        <div>
            {displayJoinCode}
            <button onClick={copyJoinCode} title={lf("Copy Join Code")}>
                <div className="tw-ml-1 tw-text-[80%]">
                    {!copySuccessful && (
                        <FontAwesomeIcon
                            icon={faCopy}
                            className="hover:tw-scale-110 tw-ease-linear tw-duration-[50ms] tw-mb-[0.1rem]"
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
    ) : null;
}
