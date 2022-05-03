import * as React from "react";
import { Button } from "../controls/Button";

interface SocialButtonProps {
    className?: string;
    url?: string;
    type?: "facebook" | "twitter" | "discourse";
    heading?: string;
}

export const SocialButton = (props: SocialButtonProps) => {
    const { className, url, type, heading } = props;

    const handleClick = () => {
        const socialOptions = pxt.appTarget.appTheme.socialOptions;
        let socialUrl = '';
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
        }
        pxt.BrowserUtils.popupWindow(socialUrl, heading, 600, 600);
    }

    return <Button className={className}
        ariaLabel={type}
        title={heading}
        leftIcon={`icon ${type}`}
        onClick={handleClick} />
}
