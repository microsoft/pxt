import * as React from "react";
import { Button } from "../controls/Button";
import { classList } from "../util";

interface SocialButtonProps {
    className?: string;
    url?: string;
    type?: "facebook" | "twitter" | "discourse" | "google-classroom" | "microsoft-teams" | "whatsapp";
    heading?: string;
}

export const SocialButton = (props: SocialButtonProps) => {
    const { className, url, type, heading } = props;

    const classes = classList(className, "social-button", "type")

    const getSocialUrl = () => {
        const socialOptions = pxt.appTarget.appTheme.socialOptions;

        switch (type) {
            case "facebook": {
                return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            }
            case "twitter": {
                let twitterText = lf("Check out what I made!");
                if (socialOptions.twitterHandle && socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0} and @{1}!", socialOptions.twitterHandle, socialOptions.orgTwitterHandle);
                }
                else if (socialOptions.twitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.twitterHandle);
                }
                else if (socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.orgTwitterHandle);
                }
                return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` +
                    `&text=${encodeURIComponent(twitterText)}` +
                    (socialOptions.hashtags ? `&hashtags=${encodeURIComponent(socialOptions.hashtags)}` : '') +
                    (socialOptions.related ? `&related=${encodeURIComponent(socialOptions.related)}` : '');
            }
            case "discourse": {
                // https://meta.discourse.org/t/compose-a-new-pre-filled-topic-via-url/28074
                let socialUrl = `${socialOptions.discourse || "https://forum.makecode.com/"}new-topic?title=${encodeURIComponent(url)}`;
                if (socialOptions.discourseCategory) {
                    socialUrl += `&category=${encodeURIComponent(socialOptions.discourseCategory)}`;
                }
                return socialUrl;
            }
            case "google-classroom":
                return `https://classroom.google.com/share?url=${encodeURIComponent(url)}`;
            case "microsoft-teams":
                return `https://teams.microsoft.com/share?href=${encodeURIComponent(url)}`;
            case "whatsapp":
                return `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`;
        }
    }

    const handleClick = () => {
        pxt.tickEvent(`share.social.${type}`);
    }

    const useLink = pxt.BrowserUtils.isInGame();

    switch (type) {
        // Icon buttons
        case "facebook":
        case "twitter":
        case "discourse":
        case "whatsapp":
            return (
                <Button className={classes}
                    ariaLabel={type}
                    title={heading}
                    leftIcon={`icon ${type}`}
                    onClick={handleClick}
                    asAnchorElement={useLink}
                    href={getSocialUrl()}
                />
            );

        // Image buttons
        case "google-classroom":
        case "microsoft-teams":
            return (
                <Button className={classes}
                    ariaLabel={type}
                    title={heading}
                    label={<img src={`/static/logo/social-buttons/${type}.png`} alt={heading || pxt.U.rlf(type)} />}
                    onClick={handleClick}
                    href={getSocialUrl()}
                    asAnchorElement={useLink}
                />
            )
    }


}
