namespace pxt.crowdin {
    export const KEY_VARIABLE = "CROWDIN_KEY";
    export let testMode = false;
    export const TEST_KEY = "!!!testmode!!!";

    export function setTestMode() {
        pxt.crowdin.testMode = true;
        pxt.log(`CROWDIN TEST MODE - files will NOT be uploaded`);
    }

    export function inContextLoadAsync(text: string): Promise<string> {
        const node = document.createElement("input") as HTMLInputElement;
        node.type = "text";
        node.setAttribute("class", "hidden");
        node.value = text;
        let p = new Promise<string>((resolve, reject) => {
            const observer = new MutationObserver(() => {
                if (text == node.value)
                    return;
                const r = Util.rlf(node.value); // get rid of {id}...
                node.remove();
                observer.disconnect();
                resolve(r);
            });
            observer.observe(node, { attributes: true });
        })
        document.body.appendChild(node);

        return p;
    }
}