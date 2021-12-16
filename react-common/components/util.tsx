import * as React from "react";

export interface ControlProps {
    id?: string;
    className?: string;
    ariaLabel?: string;
    ariaHidden?: boolean;
    role?: string;
}

export function jsxLF(loc: string, ...rest: JSX.Element[]) {
    const indices: number[] = [];

    loc.replace(/\{\d\}/g, match => {
        indices.push(parseInt(match.substr(1, 1)));
        return match;
    });

    const out: JSX.Element[] = [];

    let parts: string[];

    let i = 0;

    for (const index of indices) {
        parts = loc.split(`{${index}}`);
        pxt.U.assert(parts.length === 2);
        out.push(<span key={i++}>{parts[0]}</span>);
        out.push(<span key={i++}>{rest[index]}</span>);
        loc = parts[1]
    }
    out.push(<span key={i++}>{loc}</span>);

    return out;
}

export function fireClickOnEnter(e: React.KeyboardEvent<HTMLElement>) {
    const charCode = (typeof e.which == "number") ? e.which : e.keyCode;
    if (charCode === 13 /* enter */ || charCode === 32 /* space */) {
        e.preventDefault();
        e.currentTarget.click();
    }
}

export function classList(...classes: string[]) {
    return classes
        .filter(c => typeof c === "string")
        .reduce((prev, c) => prev.concat(c.split(" ")), [] as string[])
        .map(c => c.trim())
        .filter(c => !!c)
        .join(" ");
}