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
        name: lf("smile emoji"),
        emoji: "😃",
    },
    {
        name: lf("laugh emoji"),
        emoji: "🤣",
    },
    {
        name: lf("surprise emoji"),
        emoji: "😯",
    },
    {
        name: lf("cry emoji"),
        emoji: "😫",
    },
    {
        name: lf("scared emoji"),
        emoji: "😬",
    },
    {
        name: lf("angry emoji"),
        emoji: "😠",
    },
];
