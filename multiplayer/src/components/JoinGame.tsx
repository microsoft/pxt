import { useContext, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { joinGameAsync, leaveGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";
import { cleanupJoinCode } from "../util";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    const inputRef = useRef<HTMLInputElement>(null);

    const onJoinGameClick = async () => {
        if (inputRef.current) {
            const joinCode = cleanupJoinCode(inputRef.current.value);
            if (joinCode) {
                await joinGameAsync(joinCode);
            }
        }
    };

    return (
        <div className="tw-mt-2 tw-text-white">
            <div className="tw-text-2xl tw-font-bold">{"Join a Game"}</div>
            {netMode === "init" && (
                <div className="tw-flex tw-flex-row tw-gap-1 tw-items-end">
                    <Input
                        label={lf("Enter the Join Code")}
                        title={lf("Join Code")}
                        autoComplete={false}
                        handleInputRef={inputRef}
                        preserveValueOnBlur={true}
                        onEnterKey={onJoinGameClick}
                    />
                    <Button
                        className={"teal inverted"}
                        label={lf("Join")}
                        title={lf("Join")}
                        onClick={onJoinGameClick}
                    />
                </div>
            )}
        </div>
    );
}
