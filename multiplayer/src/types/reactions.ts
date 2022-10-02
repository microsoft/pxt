export type ReactionVars = {
    xOffset: number
    yOffset: number
    rotation: number
    scale: number
    speed: number
}

export type ReactionConsts = {
    index: number
    start: number
}

export type ReactionParticleInstance = {
    id: string
    x: number
    y: number
    consts: ReactionConsts
    vars: ReactionVars
}

type ReactionConfig = {
    spawnFreq: number
    minSpeed: number
    maxSpeed: number
    maxAngle: number
    lifetime: number
}

export type ReactionDef = {
    name: string
    emoji: string
    config: ReactionConfig
    shade: (
        t: number,
        consts: ReactionConsts,
        vars: ReactionVars
    ) => ReactionVars
}

const defaultReactionConfig: ReactionConfig = {
    spawnFreq: 2,
    minSpeed: 200,
    maxSpeed: 220,
    maxAngle: 15,
    lifetime: 5000,
}

const simpleShader = (t: number, consts: ReactionConsts, vars: ReactionVars) =>
    vars

const shakyShader = (
    t: number,
    consts: ReactionConsts,
    vars: ReactionVars
) => ({
    ...vars,
    xOffset: vars.xOffset + Math.sin(t / 100 + Math.random() * 40) * 3,
})

const slowScaleShader = (
    t: number,
    consts: ReactionConsts,
    vars: ReactionVars
) => {
    const def = ReactionDb[consts.index]
    const scale = Math.max(1, 1 + (t - consts.start) / def.config.lifetime)
    return {
        ...vars,
        scale,
    }
}

const wavyShader = (t: number, consts: ReactionConsts, vars: ReactionVars) => {
    const age = t - consts.start
    return {
        ...vars,
        xOffset: Math.sin(age / 300) * 30,
    }
}

export const ReactionDb: ReactionDef[] = [
    {
        name: lf("heart"),
        emoji: "❤️",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("thinking"),
        emoji: "🤔",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("cry"),
        emoji: "😭",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("love"),
        emoji: "😍",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("nauseated"),
        emoji: "🤮",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("smile"),
        emoji: "😃",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("look"),
        emoji: "👀",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("laugh"),
        emoji: "🤣",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("fire"),
        emoji: "🔥",
        config: defaultReactionConfig,
        shade: shakyShader,
    },
    {
        name: lf("cool"),
        emoji: "😎",
        config: defaultReactionConfig,
        shade: slowScaleShader,
    },
    {
        name: lf("angry"),
        emoji: "😡",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("party"),
        emoji: "🎉",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("thumbs up"),
        emoji: "👍",
        config: defaultReactionConfig,
        shade: wavyShader,
    },
]
