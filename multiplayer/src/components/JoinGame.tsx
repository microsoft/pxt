import { useContext, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { joinGameAsync, leaveGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";

// TODO thsparks : Repurpose this so it's just an entry point where players can enter a join code and entirely skippable if they have a direct link.

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    const inputRef = useRef<HTMLInputElement>(null);

    const onJoinGameClick = async () => {
        if (inputRef.current) {
            const joinCode = inputRef.current.value.toUpperCase().trim();
            if (joinCode) {
                await joinGameAsync(joinCode);
            }
        }
    };

    return (
        <div className="tw-mt-2">
            <div className="tw-text-2xl tw-font-bold">
                {"Joining a Game"}
            </div>
            {netMode === "init" && (
                <div className="tw-flex tw-flex-row tw-gap-1 tw-items-end">
                    <Input
                        label={lf("Join Code")}
                        title={lf("Join Code")}
                        autoComplete={false}
                        handleInputRef={inputRef}
                        preserveValueOnBlur={true}
                        onEnterKey={onJoinGameClick}
                    />
                    <Button
                        className={"teal"}
                        label={lf("Join")}
                        title={lf("Join")}
                        onClick={onJoinGameClick}
                    />
                </div>
            )}
        </div>
    );
}
