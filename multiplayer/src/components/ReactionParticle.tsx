import { useMemo, useRef } from "react";
import { Reactions, Particle } from "../types/reactions";

export default function Render(props: { particle: Particle }) {
    const { particle } = props;
    const { index } = particle;

    const emoji = Reactions[index].emoji;

    const parms = useMemo(() => {
        const flyUpDuration = 1.25 + Math.random() * 1.25;
        const flyHorzDuration = 3 * flyUpDuration + Math.random() * 10;
        return {
            flyUpDuration,
            rotationDuration: 3 + Math.random() * 0.5,
            rotationAnim:
                Math.random() > 0.5
                    ? "reaction-rotate-left"
                    : "reaction-rotate-right",
            horzAnim:
                Math.random() > 0.5
                    ? "reaction-fly-left"
                    : "reaction-fly-right",
            flyHorzDuration,
        };
    }, []);

    return (
        <div
            className="tw-absolute tw-select-none tw-pointer-events-none"
            style={{
                animation: `reaction-fly-up linear ${parms.flyUpDuration}s forwards,
                ${parms.horzAnim} linear ${parms.flyHorzDuration}s forwards`,
                zIndex: 100,
            }}
        >
            <div
                className="tw-select-none tw-pointer-events-none"
                style={{
                    animation: `${parms.rotationAnim} ease-in-out ${parms.rotationDuration}s infinite`,
                    zIndex: 100,
                }}
            >
                {emoji}
            </div>
        </div>
    );
}
