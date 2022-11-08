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
                    <div className="tw-font-bold tw-mr-1">{lf("Code:")}</div>
                    <div className="tw-text-[75%]">
                        <CopyButton
                            copyValue={joinDeepLink}
                            title={lf("Copy join link")}
                            eventName="mp.copyjoinlink"
                            label={<div className="tw-text-base">{joinCode}</div>}
                            toastMessage={lf("Join link copied")}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
