# Blocks embed

MakeCode provides a lightweight blocks rendering engine that renders code snippets into SVG images. 

## The Curse of screenshots

Unlike text based programming languages, block based snippets cannot be easily rendered in a documentation page.
A quick solution is take screenshots of the snippets but things can quickly become unsustainable:

* screenshots cannot be compiled - so it's hard to maintain then
* screenshots are not localizable - non-English speaking users won't be able to read the blocks
* screenshots cannot be reloaded easily into the editor
* screenshots don't play well with source control system - you cannot diff changes efficiently.

If you're looking for a better solution, carry on reading.

## Rendering blocks on the spot

The MakeCode approach to solve this issue is to render the code snippets on the client using the same block rendering engine as the editor. The idea is to load an IFrame from the MakeCode editor that will render the blocks for you.

## Implementation [try this fiddle](https://jsfiddle.net/ndyz1d57/1/)

The first part is to register a message handler that will communicate with the rendering ``IFrame``.
The renderer sends a ``renderready`` message when it is loaded and ready to receive messages.

```typescript-ignore
export interface RenderReadyResponseMessage extends SimulatorMessage {
    source: "makecode",
    type: "renderready"
}
```

It sends back a ``renderblocks`` response message with the rendered blocks.

```typescript-ignore
export interface RenderBlocksRequestMessage extends SimulatorMessage {
    type: "renderblocks",
    id: string;
    code: string;
    options?: {
        package?: string;
        snippetMode?: boolean;
    }
}

export interface RenderBlocksResponseMessage extends SimulatorMessage {
    source: "makecode",
    type: "renderblocks",
    id: string;
    svg?: string;
    width?: number;
    height?: number;
}
```

This snippet registers a message handler. Feel free to write it using your favorite JS framework.

```typescript-ignore
window.addEventListener("message", function (ev) {
    var msg = ev.data;
    if (msg.source != "makecode") return;

    switch (msg.type) {
        case "renderready":
            // TODO: start rendering snippets!
            break;
        case "renderblocks":
            var svg = msg.svg; // this is an string containing SVG
            var id = msg.id; // this is the id you sent
            // replace text with svg
            var img = document.createElement("img");
            img.src = msg.uri;
            img.width = msg.width;
            img.height = msg.height;
            var code = document.getElementById(id)
            code.parentElement.insertBefore(img, code)
            code.parentElement.removeChild(code);
            break;
    }
}, false);
```

To request to render code, send a ``renderblocks`` message to the rendering IFrame.

```typescript-ignore
function makeCodeRenderPre(pre) {
    var f = document.getElementById("makecoderenderer");
    f.contentWindow.postMessage({
        type: "renderblocks",
        id: pre.id,
        code: pre.innerText
    }, "@homeurl@");
}
```

The last step is to load the rendering iFrame in the HTML DOM and hide it so that it does not interferre with your page.

```typescript-ignore
function makeCodeInjectRenderer() {
    var f = document.createElement("iframe");
    f.id = "makecoderenderer";
    f.style.position = "absolute";
    f.style.left = 0;
    f.style.bottom = 0;
    f.style.width = "1px";
    f.style.height = "1px";            
    f.src = "@homeurl@--docs?render=1"
    document.body.appendChild(f);
}

// load the renderer
makeCodeInjectRenderer();
```