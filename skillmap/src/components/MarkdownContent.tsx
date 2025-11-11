import * as Marked from "marked";
import DOMPurify from "dompurify";
import * as React from "react";

interface Props {
    markdown: string;
}

export const MarkdownContent = (props: Props) => {
    const sanitizedHTML = useSanitizedMarkdown(props.markdown);

    let containerRef: HTMLDivElement | null = null;

    const handleRef = (ref: HTMLDivElement) => {
        if (ref) containerRef = ref;
    }

    React.useEffect(() => {
        if (sanitizedHTML && containerRef) {
            // Note: this innerHTML has been sanitized by DOMPurify
            // eslint-disable-next-line @microsoft/sdl/no-inner-html
            containerRef.innerHTML = sanitizedHTML;
        }
    }, [containerRef, sanitizedHTML])

    if (!sanitizedHTML) {
        return (
            <div className="common-spinner" />
        );
    }

    return (
        <div ref={handleRef}></div>
    );
}


function useSanitizedMarkdown(markdown: string): string | undefined {
    const [sanitized, setSanitized] = React.useState<string>();

    React.useEffect(() => {
        // Only applies to ancient browsers like IE
        if (!DOMPurify.isSupported) {
            setSanitized(`<div></div>`)
            return;
        }

        (async () => {
            const unsanitized = await Marked.parse(markdown);
            setSanitized(DOMPurify.sanitize(unsanitized));
        })();
    }, [markdown])

    return sanitized;
}