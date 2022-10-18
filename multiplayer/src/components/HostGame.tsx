import { useContext, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { hostGameAsync } from "../epics";
import { Input } from "../../../react-common/components/controls/Input";
import { Button } from "../../../react-common/components/controls/Button";
import { dispatch } from "../state";
import { showToast } from "../state/actions";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { appMode } = state;
    const { netMode } = appMode;

    const inputRef = useRef<HTMLInputElement>(null);

    const onHostGameClick = async () => {
        if (inputRef.current) {
            const gameId = pxt.Cloud.parseScriptId(inputRef.current.value);
            if (gameId) {
                await hostGameAsync(gameId);
            } else {
                dispatch(
                    showToast({
                        type: "error",
                        text: lf("Invalid share code"),
                        timeoutMs: 5000,
                    })
                );
            }
        }
    };

    return (
        <div className="tw-mt-2 tw-h-max tw-flex-row">
            <div className="tw-text-2xl tw-font-bold">
                {"Hosting a Game"}
            </div>
            {netMode === "init" && (
                <div className="tw-flex tw-flex-row tw-gap-1 tw-items-end">
                    <Input
                        label={lf("Game URL or Share Code")}
                        title={lf("Game URL or Share Code")}
                        autoComplete={false}
                        handleInputRef={inputRef}
                        preserveValueOnBlur={true}
                        onEnterKey={onHostGameClick}
                    />
                    <Button
                        className={"teal"}
                        label={lf("Host")}
                        title={lf("Host")}
                        onClick={onHostGameClick}
                    />
                </div>
            )}
        </div>
    );
}
