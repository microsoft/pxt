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

    const handleClick = () => {
        const socialOptions = pxt.appTarget.appTheme.socialOptions;
        let socialUrl = '';

        pxt.tickEvent(`share.social.${type}`);
        switch (type) {
            case "facebook": {
                socialUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
            }
            case "twitter": {
                let twitterText = lf("Check out what I made!");
                if (socialOptions.twitterHandle && socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0} and @{1}!", socialOptions.twitterHandle, socialOptions.orgTwitterHandle);
                } else if (socialOptions.twitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.twitterHandle);
                } else if (socialOptions.orgTwitterHandle) {
                    twitterText = lf("Check out what I made with @{0}!", socialOptions.orgTwitterHandle);
                }
                socialUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}` +
                    `&text=${encodeURIComponent(twitterText)}` +
                    (socialOptions.hashtags ? `&hashtags=${encodeURIComponent(socialOptions.hashtags)}` : '') +
                    (socialOptions.related ? `&related=${encodeURIComponent(socialOptions.related)}` : '');
                break;
            }
            case "discourse": {
                // https://meta.discourse.org/t/compose-a-new-pre-filled-topic-via-url/28074
                socialUrl = `${socialOptions.discourse || "https://forum.makecode.com/"}new-topic?title=${encodeURIComponent(url)}`;
                if (socialOptions.discourseCategory)
                socialUrl += `&category=${encodeURIComponent(socialOptions.discourseCategory)}`;
                break;
            }
            case "google-classroom":
                socialUrl = `https://classroom.google.com/share?url=${encodeURIComponent(url)}`;
                break;
            case "microsoft-teams":
                socialUrl = `https://teams.microsoft.com/share?href=${encodeURIComponent(url)}`;
                break;
            case "whatsapp":
                socialUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`;
                break;
        }
        pxt.BrowserUtils.popupWindow(socialUrl, heading, 600, 600);
    }

    switch (type) {
        // Icon buttons
        case "facebook":
        case "twitter":
        case "discourse":
        case "whatsapp":
            return <Button className={classes}
                ariaLabel={type}
                title={heading}
                leftIcon={`icon ${type}`}
                onClick={handleClick} />

        // Image buttons
        case "google-classroom":
        case "microsoft-teams":
            return <Button className={classes}
                ariaLabel={type}
                title={heading}
                label={<img src={`/static/logo/social-buttons/${type}.png`} alt={heading || pxt.U.rlf(type)} />}
                onClick={handleClick} />
    }


}
