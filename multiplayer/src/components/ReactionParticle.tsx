import { useContext, useMemo } from "react";
import { AppStateContext } from "../state/AppStateContext";
import { Reactions, Particle } from "../types/reactions";

export default function Render(props: { particle: Particle }) {
    const { particle } = props;
    const { index } = particle;
    const { state } = useContext(AppStateContext);
    const { gameState } = state;
    const reactionIconOverrides = gameState?.reactionIconOverrides;

    const emoji = Reactions[index].emoji;

    const parms = useMemo(() => {
        const flyUpDuration = 1.25 + Math.random() * 1.25;
        const flyHorzDuration = 3 * flyUpDuration + Math.random() * 10;
        return {
            flyUpDuration,
            rotationDuration: 3 + Math.random() * 0.5,
            rotationAnim: Math.random() > 0.5 ? "reaction-rotate-left" : "reaction-rotate-right",
            horzAnim: Math.random() > 0.5 ? "reaction-fly-left" : "reaction-fly-right",
            flyHorzDuration,
        };
    }, []);

    const override = reactionIconOverrides?.[index + 1];
    const display = override ? (
        <img className="pixel-art-image tw-w-[100%]" src={override} alt={lf("Game reaction image {0}", index + 1)} />
    ) : (
        emoji
    );

    return (
        <div
            className="tw-absolute tw-select-none tw-pointer-events-none tw-z-[100]"
            style={{
                animation: `reaction-fly-up linear ${parms.flyUpDuration}s forwards,
                ${parms.horzAnim} linear ${parms.flyHorzDuration}s forwards`,
                width: override ? "1.5rem" : undefined,
                height: override ? "1.5rem" : undefined,
            }}
        >
            <div
                className="tw-select-none tw-pointer-events-none"
                style={{
                    animation: `${parms.rotationAnim} ease-in-out ${parms.rotationDuration}s infinite`,
                }}
            >
                {display}
            </div>
        </div>
    );
}
