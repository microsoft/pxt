import { useContext, useEffect, useState } from "react";
import { AppStateContext } from "../state/AppStateContext";
import ReactionParticle from "./ReactionParticle";
import { Particle } from "../types/reactions";

export default function Render(props: { clientId: string }) {
    const { state } = useContext(AppStateContext);
    const { clientId } = props;
    const reaction = state.reactions[clientId];

    const [activeParticles, setActiveParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (!reaction) return;
        if (!activeParticles.find(p => p.id === reaction.id)) {
            // Add new particle for this reaction
            const particle: Particle = {
                id: reaction.id,
                index: reaction.index,
                startTime: Date.now(),
            };
            setActiveParticles(activeParticles => [...activeParticles, particle]);
        }
    }, [reaction, activeParticles, setActiveParticles]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActiveParticles(
                activeParticles.filter(p => {
                    const age = now - p.startTime;
                    return age < 5000;
                })
            );
        }, 1000);
        return () => clearInterval(interval);
    }, [activeParticles, setActiveParticles]);

    return (
        <div
            className="tw-absolute tw-pointer-events-none"
            style={{
                // Center emitter over avatar's face
                transform: `translateY(-20px)`,
            }}
        >
            <div className="tw-flex tw-flex-row tw-justify-center">
                {activeParticles.map(p => {
                    return <ReactionParticle key={p.id} particle={p} />;
                })}
            </div>
        </div>
    );
}
