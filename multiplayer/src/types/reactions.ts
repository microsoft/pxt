export type ReactionDef = {
    name: string;
    emoji: string;
};

export type Particle = {
    id: string;
    index: number;
    startTime: number;
};
export const Reactions: ReactionDef[] = [
    {
        name: lf("smile"),
        emoji: "😃",
    },
    {
        name: lf("laugh"),
        emoji: "🤣",
    },
    {
        name: lf("surprise"),
        emoji: "😯",
    },
    {
        name: lf("cry"),
        emoji: "😫",
    },
    {
        name: lf("scared"),
        emoji: "😬",
    },
    {
        name: lf("angry"),
        emoji: "😠",
    },
];
