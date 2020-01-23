namespace pxt.dom {
    export function el(name: string, 
        attributes?: pxt.Map<string | number>, 
        children?: string | HTMLElement | (string | HTMLElement)[]): HTMLElement {
        const el = document.createElement(name);
        if (attributes)
            Object.keys(attributes).forEach(k => el.setAttribute(k, attributes[k] + ""));
        if (Array.isArray(children))
            children.forEach(t => appendChild(t));
        else appendChild(children);
        return el;

        function appendChild(c: string | HTMLElement) {
            if (c instanceof String) el.appendChild(document.createTextNode(c as string));
            else if (c instanceof HTMLElement) el.appendChild(c as HTMLElement);
        }
    }
}