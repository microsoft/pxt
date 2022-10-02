import { useRef, useEffect, useCallback, useMemo } from "react"
import { ReactionDb, ReactionParticleInstance } from "../types/reactions"

export default function Render(props: { particle: ReactionParticleInstance }) {
    const { particle } = props
    const { vars } = particle

    const emoji = ReactionDb[particle.consts.index].emoji

    return (
        <div
            className="fixed"
            style={{
                left: particle.x + vars.xOffset,
                top: particle.y + vars.yOffset,
                transform: `scale(${vars.scale})`,
                zIndex: 100,
            }}
        >
            {emoji}
        </div>
    )
}
