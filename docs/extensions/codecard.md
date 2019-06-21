# Defining CodeCards

```typescript
    interface CodeCard {
        name?: string;
        shortName?: string;
        title?: string;
        label?: string;

        color?: string; // one of semantic ui colors
        description?: string;
        blocksXml?: string;
        typeScript?: string;
        imageUrl?: string;
        youTubeId?: string;
        time?: number;
        url?: string;
        responsive?: boolean;
        cardType?: "example" | "tutorial" | "project";

        header?: string;
        any?: number;
        hardware?: number;
        software?: number;
        blocks?: number;
        javascript?: number;

        icon?: string;
        iconColor?: string;

        onClick?: (e: any) => void; // React event

        target?: string;
        className?: string;
    }
```