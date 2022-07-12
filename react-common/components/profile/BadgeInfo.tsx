import * as React from "react";
import { jsxLF } from "../util";
import { Badge } from "./Badge";

export interface BadgeInfoProps {
    badge: pxt.auth.Badge;
}

export const BadgeInfo = (props: BadgeInfoProps) => {
    const { badge } = props;

    const date = new Date(badge.timestamp)

    return <div className="profile-badge-info">
        <div className="profile-badge-info-image">
            <Badge badge={badge} disabled={!badge.timestamp} />
        </div>
        <div className="profile-badge-info-item" id={"profile-badge-info-" + badge.id}>
            <div className="profile-badge-info-header">
                {lf("Awarded For:")}
            </div>
            <div className="profile-badge-info-text">
                {badgeDescription(badge)}
            </div>
        </div>
        { badge.timestamp ?
            <div className="profile-badge-info-item">
                <div className="profile-badge-info-header">
                    {lf("Awarded On:")}
                </div>
                <div className="profile-badge-info-text">
                    {date.toLocaleDateString(pxt.U.userLanguage())}
                </div>
            </div>
        : undefined }
    </div>
}


export const badgeDescription = (badge: pxt.auth.Badge) => {
    switch (badge.type) {
        case "skillmap-completion":
            return <span>{jsxLF(
                lf("Completing {0}"),
                <a
                    tabIndex={0}
                    aria-labelledby={"profile-badge-info-" + badge.id}
                    target="_blank"
                    rel="noopener noreferrer"
                    href={sourceURLToSkillmapURL(badge.sourceURL)}>
                        {pxt.U.rlf(badge.title)}
                </a>
            )}</span>
    }
}

function sourceURLToSkillmapURL(sourceURL: string) {
    if (sourceURL.indexOf("/api/md/") !== -1) {
        // docs url: https://www.makecode.com/api/md/arcade/skillmap/forest
        const path = sourceURL.split("/api/md/")[1];
        // remove the target from the url
        const docsPath = path.split("/").slice(1).join("/");
        return pxt.webConfig?.skillmapUrl + "#docs:" + docsPath;
    }
    else {
        // github url: /user/repo#filename
        const parts = sourceURL.split("#");

        if (parts.length == 2) {
            return pxt.webConfig.skillmapUrl + "#github:https://github.com/" + parts[0] + "/" + parts[1];
        }
    }

    if (pxt.BrowserUtils.isLocalHostDev()) {
        // local url: skillmap/forest
        return "http://localhost:3000#local:" + sourceURL
    }

    return sourceURL;
}

