import * as React from "react";
import { Button } from "../../../react-common/components/controls/Button";
import * as simulator from "../simulator";

export function SimulatorPresenceBar() {
    return (<div className="sim-presence-bar">
        <PlayerPresenceIcon slot={1} />
        <PlayerPresenceIcon slot={2} />
        <PlayerPresenceIcon slot={3} />
        <PlayerPresenceIcon slot={4} />
    </div>);
}

function PlayerPresenceIcon(props: React.PropsWithoutRef<{slot: 1 | 2 | 3 | 4}>) {
    const { slot } = props;

    const onClick = () => {
        const setSlotMsg: pxsim.SetActivePlayerMessage = {
            type: "setactiveplayer",
            playerNumber: slot,
        };
        const connectionMsg: pxsim.multiplayer.ConnectionMessage = {
            type: "multiplayer",
            content: "Connection",
            slot: slot,
            connected: true,
        };
        simulator.driver.postMessage(setSlotMsg);
        simulator.driver.postMessage(connectionMsg);
        simulator.driver.focus();
    }
    return (<Button
        className={`sim-presence-bar-player player-${slot}`}
        title={lf("Player {0}", slot)}
        onClick={onClick}
    />);
}