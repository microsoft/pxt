namespace pxt.dom {
    export function el(name: string,
        attributes?: pxt.Map<string | number>,
        children?: string | HTMLElement | (string | HTMLElement)[]): HTMLElement {
        const output = document.createElement(name);
        if (attributes)
            Object.keys(attributes).forEach(k => output.setAttribute(k, attributes[k] + ""));
        appendChild(children);
        return output;

        function appendChild(c: string | HTMLElement | (string | HTMLElement)[]) {
            if (Array.isArray(c)) c.forEach(cc => appendChild(cc));
            else if (typeof c === "string") output.appendChild(document.createTextNode(c as string));
            else if (c instanceof HTMLElement) output.appendChild(c as HTMLElement);
        }
    }
}