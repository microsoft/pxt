import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import CopyButton from "./CopyButton";

export default function Render() {
    const { state } = useContext(AppStateContext);

    const joinCode = state.gameState?.joinCode;
    const joinDeepLink = joinCode
        ? pxt.multiplayer.makeJoinLink(joinCode, true)
        : "";
    return (
        <div>
            {joinCode && (
                <div className="tw-flex tw-flex-row tw-items-center tw-align-middle">
                    <div className="tw-font-bold tw-mr-1">{lf("Code:")}</div>
                    <CopyButton
                        copyValue={joinDeepLink}
                        title={lf("Copy join link")}
                        eventName="mp.copyjoinlink"
                        label={joinCode}
                        toastMessage={lf("Join link copied")}
                    />
                </div>
            )}
        </div>
    );
}
