import * as React from "react";
import { Badge } from "./Badge";

export interface BadgeInfoProps {
    badge: pxt.auth.Badge;
}

export const BadgeInfo = (props: BadgeInfoProps) => {
    const { badge } = props;

    const date = new Date(badge.timestamp)

    return <div className="profile-badge-info">
        <div className="profile-badge-info-image">
            <Badge badge={badge} />
        </div>
        <div className="profile-badge-info-header">
            {lf("Awarded For:")}
        </div>
        <div className="profile-badge-info-text">
            {badgeDescription(badge)}
        </div>
        { badge.timestamp ?
            <div className="profile-badge-info-header">
                {lf("Awarded On:")}
            </div>
            : undefined
        }
        { badge.timestamp ?
            <div className="profile-badge-info-text">
                {date.toLocaleDateString(pxt.U.userLanguage())}
            </div>
            : undefined
        }
    </div>
}


export const badgeDescription = (badge: pxt.auth.Badge) => {
    switch (badge.type) {
        case "skillmap":
            return <span>{jsxLF(
                lf("Completing the {0}"),
                <a href={badge.sourceURL}>{pxt.U.rlf(badge.title)}</a>
            )}</span>
    }
}

function jsxLF(loc: string, ...rest: JSX.Element[]) {
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
    }
    out.push(<span key={i++}>{parts[1]}</span>);

    return out;
}