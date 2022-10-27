import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import CopyButton from "./CopyButton";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const [copySuccessful, setCopySuccessful] = useState(false);
    const copyTimeoutMs = 2500;

    const joinCode = state.gameState?.joinCode;
    return (
        <div>
            {joinCode && (
                <div className="tw-flex tw-flex-row tw-items-center tw-align-middle">
                    <div className="tw-font-bold">{lf("Code:")}</div>
                    <div className="tw-mx-1">{joinCode}</div>
                    <div className="tw-text-[75%]">
                        <CopyButton
                            copyValue={joinCode}
                            title={lf("Copy join code")}
                            eventName="mp.copyjoincode"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
