import * as React from "react";
import { resolvePath } from "../lib/browserUtils";

interface LoaderLogoProps {
    alt: string;
}

/**
 * Renders the animated loading logo. The logo image is painted as-is by
 * default, but targets can recolor a single-color logo by setting the
 * --pxt-loader-logo-color css variable, which paints the logo shape (used as
 * a mask) in that color instead.
 */
export const LoaderLogo = (props: LoaderLogoProps) => {
    const { alt } = props;
    const logoUrl = resolvePath("assets/logo.svg");

    return <div
        className="makecode-frame-loader-logo"
        style={{ "--pxt-loader-logo-image": `url("${logoUrl}")` } as React.CSSProperties}
    >
        <img src={logoUrl} alt={alt} />
        <div className="makecode-frame-loader-logo-color" aria-hidden={true} />
    </div>
}
