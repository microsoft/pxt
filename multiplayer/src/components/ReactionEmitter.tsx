import {
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    useMemo,
} from "react"
import { AppStateContext } from "../state/AppStateContext"
import ReactionParticle from "./ReactionParticle"
import {
    ReactionConsts,
    ReactionVars,
    ReactionDb,
    ReactionParticleInstance,
} from "../types/reactions"

type Particle = ReactionParticleInstance & {
    dx: number
}

const MAX_PARTICLES = 20

export default function Render(props: {
    userId: string
    parentRef: HTMLDivElement
}) {
    const { state } = useContext(AppStateContext)
    const { userId } = props
    const reaction = state.reactions[userId]

    const [, updateTrigger] = useState(0)
    const forceUpdate = useCallback(() => updateTrigger(x => x + 1), [])

    const animRef = useRef(0)
    const [activeParticles, setActiveParticles] = useState<Particle[]>([])

    const parentBounds = useMemo(() => {
        return (
            props.parentRef?.getBoundingClientRect() ?? {
                left: 0,
                top: 0,
                width: 0,
                height: 0,
            }
        )
    }, [props.parentRef])

    const animate = useCallback(
        (t: number) => {
            activeParticles.forEach(p => {
                const def = ReactionDb[p.consts.index]
                const age = t - p.consts.start
                if (age > def.config.lifetime) {
                    setActiveParticles(activeParticles =>
                        activeParticles.filter(x => x.id !== p.id)
                    )
                } else {
                    const def = ReactionDb[p.consts.index]
                    p.y -= p.vars.speed / 60
                    p.x += p.dx / 60
                    p.vars = def.shade(t, p.consts, p.vars)
                }
                forceUpdate()
            })
            animRef.current = requestAnimationFrame(animate)
        },
        [activeParticles, setActiveParticles]
    )

    useEffect(() => {
        animRef.current = requestAnimationFrame(animate)
        return () => window.cancelAnimationFrame(animRef.current)
    }, [animate])

    useEffect(() => {
        if (!reaction) return
        if (activeParticles.length >= MAX_PARTICLES) return // Would be better to replace oldest particle
        const def = ReactionDb[reaction.index]
        if (!activeParticles.find(p => p.id === reaction.id)) {
            // Add new particle for this reaction
            const consts: ReactionConsts = {
                index: reaction.index,
                start: performance.now(),
            }
            const vars: ReactionVars = def.shade(0, consts, {
                xOffset: 0,
                yOffset: 0,
                rotation: 0,
                scale: 1,
                speed:
                    def.config.minSpeed +
                    Math.random() * (def.config.maxSpeed - def.config.minSpeed),
            })
            const particle: Particle = {
                id: reaction.id,
                x: parentBounds.left + parentBounds.width / 4,
                y: parentBounds.top,
                dx: -20 + Math.random() * 40,
                consts,
                vars,
            }
            setActiveParticles(activeParticles => [
                ...activeParticles,
                particle,
            ])
        }
    }, [reaction, activeParticles, setActiveParticles, parentBounds])

    return (
        <div>
            <div className="flex flex-row">
                {activeParticles.map(p => {
                    return <ReactionParticle key={p.id} particle={p} />
                })}
            </div>
        </div>
    )
}
