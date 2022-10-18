export type ReactionVars = {
    xOffset: number;
    yOffset: number;
    rotation: number;
    scale: number;
    speed: number;
};

export type ReactionConsts = {
    index: number;
    start: number;
    seed: number; // initialized to Math.random() * 100
};

export type ReactionParticleInstance = {
    id: string;
    x: number;
    y: number;
    consts: ReactionConsts;
    vars: ReactionVars;
};

type ReactionConfig = {
    spawnFreq: number;
    minSpeed: number;
    maxSpeed: number;
    maxAngle: number;
    lifetime: number;
    scale: number;
};

export type ReactionDef = {
    name: string;
    emoji: string;
    config: ReactionConfig;
    shade: (
        t: number,
        consts: ReactionConsts,
        vars: ReactionVars
    ) => ReactionVars;
};

const defaultReactionConfig: ReactionConfig = {
    spawnFreq: 2,
    minSpeed: 100,
    maxSpeed: 105,
    maxAngle: 15,
    lifetime: 5000,
    scale: 1.5,
};

const simpleShader = (t: number, consts: ReactionConsts, vars: ReactionVars) =>
    vars;

const swirlyShader = (
    t: number,
    consts: ReactionConsts,
    vars: ReactionVars
) => {
    const def = ReactionDb[consts.index];
    const age = t - consts.start;
    const pct = age / def.config.lifetime;
    return {
        ...vars,
        xOffset: -Math.sin(age / 100) * Math.max(15, pct * 30),
        yOffset: -Math.cos(age / 100) * Math.max(15, pct * 30),
    };
};

const slowScaleShader = (
    t: number,
    consts: ReactionConsts,
    vars: ReactionVars
) => {
    const def = ReactionDb[consts.index];
    const age = t - consts.start;
    const pct = age / def.config.lifetime;
    const scale = Math.max(def.config.scale, def.config.scale + pct * 2);
    return {
        ...vars,
        scale,
    };
};

const wavyShader = (t: number, consts: ReactionConsts, vars: ReactionVars) => {
    const age = t - consts.start;
    return {
        ...vars,
        xOffset: Math.sin(age / 300) * 20,
    };
};

export const ReactionDb: ReactionDef[] = [
    {
        name: lf("smile"),
        emoji: "😃",
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
        name: lf("surprise"),
        emoji: "😯",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("cry"),
        emoji: "😫",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("scared"),
        emoji: "😬",
        config: defaultReactionConfig,
        shade: simpleShader,
    },
    {
        name: lf("angry"),
        emoji: "😠",
        config: defaultReactionConfig,
        shade: simpleShader,
    }
];
