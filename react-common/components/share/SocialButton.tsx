import * as React from "react";
import { ButtonBody, ButtonProps, inflateButtonProps } from "../controls/Button";
import { classList } from "../util";

interface SocialButtonProps {
    className?: string;
    url?: string;
    type?: "facebook" | "twitter" | "discourse" | "google-classroom" | "microsoft-teams" | "whatsapp";
    heading?: string;
}

export const SocialButton = (props: SocialButtonProps) => {
    const { className, url, type, heading } = props;

    const classes = classList(className, "social-button", "type");
    const socialOptions = pxt.appTarget.appTheme.socialOptions;
    let socialUrl = "";

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

    const handleClick = () => {
        pxt.tickEvent(`share.social.${type}`);
    }

    switch (type) {
        // Icon buttons
        case "facebook":
        case "twitter":
        case "discourse":
        case "whatsapp":
            return (
                <LinkButton
                    className={classList(classes, "social-icon")}
                    ariaLabel={type}
                    title={heading}
                    href={socialUrl}
                    leftIcon={`icon ${type}`}
                    heading={heading}
                    onClick={handleClick}
                />
            );

        // Image buttons
        case "google-classroom":
        case "microsoft-teams":
            return (
                <LinkButton
                    className={classes}
                    ariaLabel={type}
                    title={heading}
                    href={socialUrl}
                    label={
                        <img
                            src={`/static/logo/social-buttons/${type}.png`}
                            alt={heading || pxt.U.rlf(type)}
                        />
                    }
                    heading={heading}
                    onClick={handleClick}
                />
            );
    }
}

const LinkButton = (props: ButtonProps & { heading: string }) => {
    const inflatedProps = inflateButtonProps(props);

    const onClick = (ev: React.MouseEvent) => {
        if (props.onClick) {
            props.onClick();
        }

        ev.stopPropagation();

        // if we are in game, don't call preventDefault so that the default browser
        // navigation behavior occurs
        if (!pxt.BrowserUtils.isInGame()) {
            ev.preventDefault();
            pxt.BrowserUtils.popupWindow(props.href, props.heading, 600, 600);
        }
    }

    return (
        <a
            className={inflatedProps.className}
            title={inflatedProps.title}
            href={props.href}
            target="_blank"
            rel="noopener,noreferrer"
            onClick={onClick}
        >
            <ButtonBody {...props} />
        </a>
    );
}
