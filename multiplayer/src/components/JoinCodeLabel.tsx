import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { makeJoinLink } from "../util";
import CopyButton from "./CopyButton";

export default function Render() {
    const { state } = useContext(AppStateContext);

    const joinCode = state.gameState?.joinCode;
    const joinDeepLink = joinCode ? makeJoinLink(joinCode) : "";
    return (
        <div>
            {joinCode && (
                <div className="tw-flex tw-flex-row tw-items-center tw-align-middle">
                    <div className="tw-font-bold">{lf("Code:")}</div>
                    <div className="tw-mx-1">{joinCode}</div>
                    <div className="tw-text-[75%]">
                        <CopyButton
                            copyValue={joinDeepLink}
                            title={lf("Copy join link")}
                            eventName="mp.copyjoinlink"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
