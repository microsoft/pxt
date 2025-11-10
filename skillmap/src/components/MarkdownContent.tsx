import * as Marked from "marked";
import DOMPurify from "dompurify";
import * as React from "react";

interface Props {
    markdown: string;
}

export const MarkdownContent = (props: Props) => {
    const parsed = useParsedMarkdown(props.markdown);

    let containerRef: HTMLDivElement | null = null;

    const handleRef = (ref: HTMLDivElement) => {
        if (ref) containerRef = ref;
    }

    React.useEffect(() => {
        if (parsed && containerRef) {
            containerRef.innerHTML = parsed;
        }
    }, [containerRef, parsed])

    if (!parsed) {
        return (
            <div className="common-spinner" />
        );
    }

    return (
        <div ref={handleRef}></div>
    );
}


function useParsedMarkdown(markdown: string): string | undefined {
    const [parsed, setParsed] = React.useState<string>();

    React.useEffect(() => {
        // Only applies to ancient browsers
        if (!DOMPurify.isSupported) {
            setParsed(`<div></div>`)
            return;
        }

        (async () => {
            const unsanitized = await Marked.parse(markdown);
            const sanitized = DOMPurify.sanitize(unsanitized);
            setParsed(sanitized);
        })();
    }, [markdown])

    return parsed;
}