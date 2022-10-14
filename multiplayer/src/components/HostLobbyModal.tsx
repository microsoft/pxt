import { useContext } from "react";
import { Button } from "react-common/components/controls/Button";
import { Modal } from "react-common/components/controls/Modal";
import { startGameAsync } from "../epics";
import { clearModal } from "../state/actions";
import { AppStateContext } from "../state/AppStateContext";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext); 

    const onStartGameClick = async () => {
        pxt.tickEvent("mp.startgame");
        dispatch(clearModal());
        await startGameAsync();
    };

    return (
        <Modal title="Invite Players" onClose={() => dispatch(clearModal())}>
            <div className="tw-flex tw-flex-col tw-gap-1">
                <div className="tw-mt-5">
                    Join Code:{" "}
                    <span className="tw-p-2 tw-tracking-[.25rem] tw-border-1 tw-border-black tw-bg-slate-600 tw-solid tw-rounded tw-text-white">
                        {state.gameState?.joinCode}
                    </span>
                </div>
                {state.gameState?.gameMode === "lobby" && (
                    <div className="tw-mt-5">
                        <div className="tw-text-lg tw-font-bold">
                            {lf("In the lobby")}
                        </div>
                        <Button
                            className={"teal"}
                            label={lf("Start Game")}
                            title={lf("Start Game")}
                            onClick={onStartGameClick}
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}
