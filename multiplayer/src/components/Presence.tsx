import { RefObject, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ReactionEmitter from "./ReactionEmitter";
import UserIcon from "./icons/UserIcon";
import Popup from "./Popup";
import { Button } from "react-common/components/controls/Button";
import { showModal } from "../state/actions";

function PlayerMenuPopup(
    props: React.PropsWithChildren<{
        visible: boolean;
        ignoreRefs?: RefObject<Element | null>[];
        onClickedOutside: () => void;
    }>
) {
    const { children, visible, ignoreRefs, onClickedOutside } = props;
    return (
        <Popup
            className="tw-absolute tw-z-50 tw-translate-y-[-110%] tw-translate-x-[-50%] tw-rounded-lg tw-border-2 tw-border-gray-100"
            visible={visible}
            ignoreRefs={ignoreRefs}
            onClickedOutside={onClickedOutside}
        >
            <div className="tw-flex tw-flex-row tw-gap-1 tw-p-2 tw-bg-white tw-drop-shadow-xl tw-rounded-md">
                {children}
            </div>
        </Popup>
    );
}

function PlayerMenu(
    props: React.PropsWithChildren<{
        slot: number;
    }>
) {
    const { state, dispatch } = useContext(AppStateContext);
    const { presence, clientRole, playerSlot, gameState } = state;
    const presenceIconOverrides = gameState?.presenceIconOverrides;

    const { slot } = props;

    const [showPlayerMenu, setShowPlayerMenu] = useState(false);
    const playerButtonRef = useRef<Element | null>(null);
    const setPlayerButtonRef = useCallback((el: Element | null) => {
        playerButtonRef.current = el;
    }, []);

    const players = useMemo(() => {
        return presence?.users && presence.users.filter(user => user.slot < 5);
    }, [presence]);

    const onKickPlayerClicked = (slot: number) => {
        pxt.tickEvent("mp.kickplayer");
        setShowPlayerMenu(false);
        const player = players.filter(user => user.slot === slot).shift();
        if (player) {
            dispatch(showModal("kick-player", { clientId: player.id }));
        }
    };

    const onLeaveGameClicked = async () => {
        pxt.tickEvent("mp.leavegame", { role: clientRole! });
        setShowPlayerMenu(false);
        dispatch(showModal("leave-game"));
    };

    const playerMenu = () => {
        const isHost = clientRole === "host";
        const isHostSlot = slot === 1;
        const isMySlot = slot === playerSlot;
        const player = players.filter(user => user.slot === slot).shift();

        if (isHost && isMySlot) {
            // Host's own menu
            return (
                <PlayerMenuPopup
                    visible={showPlayerMenu}
                    ignoreRefs={[playerButtonRef]}
                    onClickedOutside={() => setShowPlayerMenu(false)}
                >
                    <Button
                        className="tw-m-0 tw-py-2 tw-bg-red-600 tw-text-white"
                        label={lf("End the game")}
                        title={lf("End the game")}
                        onClick={() => onLeaveGameClicked()}
                    />
                </PlayerMenuPopup>
            );
        }
        if (isHost && !isHostSlot && !!player) {
            // Host's menu for other players
            return (
                <PlayerMenuPopup
                    visible={showPlayerMenu}
                    ignoreRefs={[playerButtonRef]}
                    onClickedOutside={() => setShowPlayerMenu(false)}
                >
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
                <PlayerMenuPopup
                    visible={showPlayerMenu}
                    ignoreRefs={[playerButtonRef]}
                    onClickedOutside={() => setShowPlayerMenu(false)}
                >
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

    const user = players.find(u => u.slot === slot);
    const menu = playerMenu();
    const isEmpty = !user;
    const isMySlot = slot === playerSlot;
    const iconOverride = presenceIconOverrides?.[slot];

    return (
        <div>
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
                            backgroundColor: `rgba(var(--slot-${isEmpty ? 0 : slot}-color),0.1)`,
                            borderColor: `rgb(var(--slot-${isEmpty ? 0 : slot}-color))`,
                        }}
                    >
                        <UserIcon slot={isEmpty ? 0 : slot} dataUri={iconOverride} />
                        {user && <ReactionEmitter clientId={user.id} />}
                        {isMySlot && (
                            <div className="tw-absolute tw-translate-y-[110%]">
                                <div
                                    className="tw-z-10 tw-border tw-rounded-xl tw-text-xs tw-px-2 tw-font-medium tw-uppercase"
                                    style={{
                                        backgroundColor: "rgb(var(--you-tag-bg-color))",
                                        borderColor: "rgb(var(--you-tag-border-color))",
                                    }}
                                >
                                    {lf("you")}
                                </div>
                            </div>
                        )}
                    </div>
                }
                title={!isEmpty ? lf("Player {0}", slot) : lf("Player {0} (empty)", slot)}
                onClick={() => setShowPlayerMenu(!showPlayerMenu)}
                buttonRef={setPlayerButtonRef}
            />
        </div>
    );
}

export default function Render() {
    return (
        <div className="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-2 tw-border-l-2 tw-pl-2 tw-border-slot-0-color">
            {[1, 2, 3, 4].map(slot => {
                return <PlayerMenu key={slot} slot={slot} />;
            })}
        </div>
    );
}
