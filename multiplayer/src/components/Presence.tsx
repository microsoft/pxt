import { useContext, useMemo, useRef } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ReactionEmitter from "./ReactionEmitter";
import UserIcon from "./icons/UserIcon";
import { Button } from "react-common/components/controls/Button";

export default function Render() {
    const { state } = useContext(AppStateContext);
    const { presence } = state;

    const players = useMemo(() => {
        return presence?.users && presence.users.filter(user => user.slot < 5);
    }, [presence]);

    return (
        <div
            className={`tw-flex tw-flex-row tw-items-center tw-justify-center
            tw-gap-2 tw-border-l-2 tw-pl-2 tw-border-slot-0-color`}
        >
            {[1, 2, 3, 4].map(slot => {
                const user = players.find(u => u.slot === slot);
                return (
                    <Button
                        className={`tw-rounded-full !tw-m-0 !tw-p-0`}
                        label={
                            <div
                                key={slot}
                                className={`tw-flex tw-select-none tw-text-black
                                tw-font-bold tw-rounded-full tw-h-11 tw-border-2
                                tw-w-11 tw-justify-center tw-items-center
                                tw-text-slot-${slot}-color`}
                                style={{
                                    backgroundColor: `rgba(var(--slot-${slot}-color),0.1)`,
                                    borderColor: `rgb(var(--slot-${slot}-color))`,
                                }}
                            >
                                {user && (
                                    <>
                                        <UserIcon slot={slot} />
                                        <ReactionEmitter
                                            clientId={user.id}
                                        />
                                    </>
                                )}
                            </div>
                        }
                        title={
                            user
                                ? lf("Player {0}", slot)
                                : lf("Player {0} (empty)", slot)
                        }
                        onClick={() => {}}
                    />
                );
            })}
        </div>
    );
}
