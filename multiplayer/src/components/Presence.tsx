import { useContext, useMemo, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ReactionEmitter from "./ReactionEmitter";
import UserIcon from "./icons/UserIcon";
import Popup from "./Popup";
import { Button } from "react-common/components/controls/Button";
import { showModal } from "../state/actions";

export default function Render() {
    const { state, dispatch } = useContext(AppStateContext);
    const { presence, clientRole, playerSlot } = state;

    const [showPlayerMenu, setShowPlayerMenu] = useState(0);

    const players = useMemo(() => {
        return presence?.users && presence.users.filter(user => user.slot < 5);
    }, [presence]);

    const onKickPlayerClicked = (slot: number) => {
        setShowPlayerMenu(0);
        const player = players.filter(user => user.slot === slot).shift();
        if (player) {
            dispatch(showModal("kick-player", { clientId: player.id }));
        }
    };

    const onLeaveGameClicked = async () => {
        dispatch(showModal("leave-game"));
    };

    function PlayerMenuPopup(props: React.PropsWithChildren<{ slot: number }>) {
        const { slot, children } = props;
        return (
            <Popup
                className="tw-absolute tw-z-50 tw-translate-y-[-110%] tw-translate-x-[-50%] tw-rounded-lg tw-border-2 tw-border-gray-100"
                visible={showPlayerMenu === slot}
                onClickedOutside={() => setShowPlayerMenu(0)}
            >
                <div className="tw-flex tw-flex-row tw-gap-1 tw-p-2 tw-bg-white tw-drop-shadow-xl tw-rounded-md">
                    {children}
                </div>
            </Popup>
        );
    }

    const playerMenu = (slot: number) => {
        const isHost = clientRole === "host";
        const isHostSlot = slot === 1;
        const isMySlot = slot === playerSlot;
        const player = players.filter(user => user.slot === slot).shift();

        if (isHost && isMySlot) {
            // Host's own menu
            return (
                <PlayerMenuPopup slot={slot}>
                    <Button
                        className="tw-m-0 tw-py-2 tw-bg-red-600 tw-text-white"
                        label={lf("Leave game")}
                        title={lf("Leave game")}
                        onClick={() => onLeaveGameClicked()}
                    />
                </PlayerMenuPopup>
            );
        }
        if (isHost && !isHostSlot && !!player) {
            // Host's menu for other players
            return (
                <PlayerMenuPopup slot={slot}>
                    <Button
                        className="tw-m-0 tw-py-2 tw-bg-red-600 tw-text-white"
                        label={lf("Remove from game")}
                        title={lf("Remove from game")}
                        onClick={() => onKickPlayerClicked(slot)}
                    />
                </PlayerMenuPopup>
            );
        }
        if (!isHost && isMySlot) {
            // Guest's own menu
            return (
                <PlayerMenuPopup slot={slot}>
                    <Button
                        className="tw-m-0 tw-py-2 tw-bg-red-600 tw-text-white"
                        label={lf("Leave game")}
                        title={lf("Leave game")}
                        onClick={() => onLeaveGameClicked()}
                    />
                </PlayerMenuPopup>
            );
        }
        return null;
    };

    return (
        <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2 tw-border-l-2 tw-pl-2 tw-border-slot-0-color">
            {[1, 2, 3, 4].map(slot => {
                const user = players.find(u => u.slot === slot);
                const menu = playerMenu(slot);
                const isEmpty = !user;
                const isMySlot = slot === playerSlot;
                return (
                    <div key={slot}>
                        <div className="tw-px-[50%]">{menu}</div>
                        <Button
                            className="tw-rounded-full tw-m-0 tw-p-0"
                            hardDisabled={!menu}
                            label={
                                <div
                                    className={`tw-flex tw-select-none tw-text-black
                                    tw-font-bold tw-rounded-full tw-h-11 tw-border-2
                                    tw-w-11 tw-justify-center tw-items-center
                                    tw-text-slot-${slot}-color`}
                                    style={{
                                        backgroundColor: `rgba(var(--slot-${
                                            isEmpty ? 0 : slot
                                        }-color),0.1)`,
                                        borderColor: `rgb(var(--slot-${
                                            isEmpty ? 0 : slot
                                        }-color))`,
                                    }}
                                >
                                    <UserIcon slot={isEmpty ? 0 : slot} />
                                    {user && (
                                        <ReactionEmitter clientId={user.id} />
                                    )}
                                    {isMySlot && (
                                        <div className="tw-absolute tw-translate-y-[110%]">
                                            <div
                                                className="tw-z-10 tw-border tw-rounded-xl tw-text-xs tw-px-2 tw-font-medium tw-uppercase"
                                                style={{
                                                    backgroundColor:
                                                        "rgb(var(--you-tag-bg-color))",
                                                    borderColor:
                                                        "rgb(var(--you-tag-border-color))",
                                                }}
                                            >
                                                {lf("you")}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            }
                            title={
                                !isEmpty
                                    ? lf("Player {0}", slot)
                                    : lf("Player {0} (empty)", slot)
                            }
                            onClick={() => setShowPlayerMenu(slot)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
