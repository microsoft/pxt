import { useContext } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { Button } from "react-common/components/controls/Button";
import { resumeGameAsync } from "../epics";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { gamePaused, clientRole } = state;

    const onResumeClick = async () => {
        await resumeGameAsync();
    };

    return (
        <>
            {gamePaused && clientRole === "host" && (
                <div className="tw-fixed tw-flex tw-flex-col tw-gap-4 tw-z-40 tw-p-5 tw-bg-white tw-rounded-lg tw-drop-shadow-2xl tw-border tw-top-[50%] tw-left-[50%] tw-translate-x-[-50%] tw-translate-y-[-50%]">
                    <div className="tw-text-left tw-font-bold tw-text-lg">{lf("Game Paused")}</div>
                    <div className="tw-text-left">{lf("The game is paused. Press the resume button to continue.")}</div>
                    <div className="tw-text-right">
                        <Button title={lf("Resume")} label={lf("Resume")} className="primary" onClick={onResumeClick} />
                    </div>
                </div>
            )}
            {gamePaused && clientRole !== "host" && (
                <div className="tw-fixed tw-flex tw-flex-col tw-gap-4 tw-z-40 tw-p-5 tw-bg-white tw-rounded-lg tw-drop-shadow-2xl tw-border tw-top-[50%] tw-left-[50%] tw-translate-x-[-50%] tw-translate-y-[-50%]">
                    <div className="tw-text-left tw-font-bold tw-text-lg">{lf("Game Paused")}</div>
                    <div className="tw-text-left">
                        {lf("The game is paused. Please wait for the host to resume the game.")}
                    </div>
                </div>
            )}
        </>
    );
}
