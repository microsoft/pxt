# Blocks embed

MakeCode provides a lightweight blocks rendering engine that renders code snippets into SVG images. 

## The Curse of screenshots

Unlike text based programming languages, block based snippets aren't be easily rendered in a documentation page.
A quick solution is take screenshots of the snippets but that approach can quickly become unsustainable:

* screenshots don't compile - so it's hard to maintain then
* screenshots aren't localizable - non-English speaking users won't be able to read the blocks
* screenshots can't reload easily into the editor
* screenshots don't play well with source control system - you can't diff changes efficiently.

## Rendering blocks on the spot

The MakeCode approach to solving this issue is to render the **JavaScript** code snippets on the client using the same block rendering engine as the editor. Under the hood, an ``iframe`` from the MakeCode editor will render the blocks for you.

## GitHub pages #githubpages

You can use [GitHub pages](https://help.github.com/en/github/working-with-github-pages) to render your README.md file as a web site.

* enable [GitHub pages](https://help.github.com/en/github/working-with-github-pages/creating-a-github-pages-site#creating-your-site) on your repository
* add the following entry in the ``_config.yml``

```
  makecode:
    home_url: @homeurl@
```

* copy the following text at the bottom of your ``README.md`` file
```
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
```

## Other Plugins

Here is an integration sample:

* [React component](https://github.com/microsoft/pxt-react-extension-template/blob/master/src/components/snippet.tsx)
* [HTML only](https://jsfiddle.net/L8msdjpu/2/)
* [MkDocs plugin](https://microsoft.github.io/pxt-mkdocs-sample/)

## Custom rendering

To render blocks in your own HTML documents or to make plugins for a document platform (such as a CMS or blogging engine), a custom implementation is needed. You can use the MakeCode blocks rendering engine to render blocks for code snippets in your own documents.

### ~ hint

Try this [fiddle](https://jsfiddle.net/nq0hyz97/) to see an embedded blocks rendering example.

### ~

An outer document contains the code snippets to render. This document hosts a hidden ``iframe`` which has the rendering engine attached to it. Messages are sent between the outer document and the renderer to sequence the code snippet rendering process.

### Rendering message sequence

#### Render Ready Response message

A message handler is registered to communicate with the rendering ``iframe``. The renderer sends a ``renderready`` message to this handler when it has loaded and is ready to receive messages. The message handler can now get the code snippets in the document and begin sending them to the ``iframe``.

The ``renderready`` response has this message format:

```typescript-ignore
export interface RenderReadyResponseMessage extends SimulatorMessage {
    source: "makecode",
    type: "renderready"
}
```

#### Render Blocks Request message

The outer document passes each snippet element it wants to render to the renderer in a ``renderblocks`` request message. This message is posted to the ``iframe`` content window.

The ``renderblocks`` request has this message format:

```typescript-ignore
export interface RenderBlocksRequestMessage extends SimulatorMessage {
    type: "renderblocks",
    id: string;
    code: string;
    options?: {
        package?: string;
        packageId?: string;
        snippetMode?: boolean;
    }
}
```

* ``id``: The identifer of the snippet element. This is used to match the document element of the snippet with the rendered blocks returned later.
* ``code``: The text of the code snippet to send, compile, and render. The snippet may be JavaScript or the Blockly XML payload.
* ``packageId``: the identifier of a project shared in the editor (without the ``https://makecode.com/`` prefix)

#### Render Blocks Response message

The renderer sends back a ``renderblocks`` response after it has transformed the code into a block image. The block image is returned in two forms: as a SVG element and as an image data source.

The ``renderblocks`` response has this message format:

```typescript-ignore
export interface RenderBlocksResponseMessage extends SimulatorMessage {
    source: "makecode",
    type: "renderblocks",
    id: string;
    svg?: string;
    uri?: string;
    width?: number;
    height?: number;
    error?: string;
}
```

* ``id``: The identifer of the snippet element. This is used to replace the document element of the snippet with the rendered blocks or to associate the rendered blocks if the snippet is to be retained in the document.
* ``svg``: The SVG image element.
* ``uri``: The data source of the blocks image.
* ``width``: The width of the SVG blocks image.
* ``height``: The height of the SVG blocks image.

### Message Handler

To receive messages from the renderer, the document registers a handler using the DOM [addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) method. This is registered for the ``message`` event. The two responses it waits for are ``renderready`` and ``renderblocks``. The message contents are in the format described above.

The handler must check that the ``source`` value in the message contains ``"makecode"`` to be certain that this message came from the blocks renderer.

#### Responding to ``renderready``

When the ``renderready`` response is received, the document can begin collecting and sending its code snippets to the renderer. A method for gathering snippet code and sending it to the renderer is shown in the [makeCodeRenderPre](/blocks-embed#makecoderenderpre) function.

#### Responding to ``renderblocks``

The ``renderblocks`` message is received as a response to a previous ``renderblocks`` request sent by the document. The message contains an image of the rendered blocks if compilation of the code snippet sent was successful. The image can be inserted into the DOM by matching the ``id`` of the original snippet element with the ``id`` in the message. The image is provided as both SVG and ``img`` data. The implementation can decide which form it wants to use. Depending on how the blocks are to be displayed, the original snippet elements are replaced by the blocks image or the blocks are added to the DOM next to them.

#### Handler example

As an example, let's say that a document has all of its code snippets contained in ``pre`` elements:

```
<pre>
basic.showString("Hello World")
</pre>
```

A message handler is registered for ``message`` events. For the ``renderready`` message, all the snippets are collected and given a 'snippet-x' identifier. Each snippet is passed to [makeCodeRenderPre](/blocks-embed#makecoderenderpre) to get a block image for it. When the block image is returned in the ``renderblocks`` message, the message identifier is matched to a ``pre`` tag and the element is replaced by an ``img`` element containing the block image data.

This example uses standard DOM methods but feel free to write it using your favorite JS framework.

```typescript-ignore
window.addEventListener("message", function (ev) {
    var msg = ev.data;
    if (msg.source != "makecode") return;

    switch (msg.type) {
        case "renderready":
            var snippets = document.getElementsByTagName("pre")
            for (var i = 0; i< snippets.length; i++) {
                snippets[i].id = "snippet-" + i;
                makeCodeRenderPre(snippets[i]);
            }
            break;
        case "renderblocks":
            var svg = msg.svg; // this is a string containing SVG
            var id = msg.id;   // this is the id you sent
            // replace text with svg
            var img = document.createElement("img");
            img.src = msg.uri;
            img.width = msg.width;
            img.height = msg.height;
            var snippet = document.getElementById(id)
            snippet.parentNode.insertBefore(img, snippet)
            snippet.parentNode.removeChild(snippet);
            break;
    }
}, false);
```

### Sending snippets to the renderer #makecoderenderpre

To request a code render, a ``renderblocks`` message is sent to the rendering ``iframe``. First, the request message is prepared with the matching element identifier set in the message ``id``. Then, the code snippet text is taken from the inner part of its containing element and set as the ``data`` value of the message. The message is posted to the ``iframe``.

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

### Create the ``iframe`` renderer

Finally, the rendering ``iframe`` is added to the HTML DOM and is hidden so that it does not interfere with the outer document page.

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

Once this ``iframe`` loads, it sends the ``renderready`` message to the registered handler.

### Putting it together #example

This HTML document example contains three ``pre`` elements with code snippets. Only two are sent to the renderer since they're filtered on their class as ``blocks``. Each element sent is given an identifier to match up with the rendered block that is returned. JQuery is used in this example but another framework or standard DOM methods could be used too.

```html
<html lang="en">
<head>
    <title>Blocks Embedding Test Page</title>
    <script src="https://ajax.aspnetcdn.com/ajax/jQuery/jquery-3.3.1.min.js"></script>
    <style>
        html {font-family: Arial, Helvetica, sans-serif}
        .boxdiv {padding:5px; display:inline-block; border: solid; background-color: lightgray}
    </style>
</head>
<body>

<h1>Blocks Embedding Test Page</h1>

<h2>Try embedding some blocks...</h2>

<p>Render <b>basic.showString():</b></p>

<div class="boxdiv">
    <pre class="blocks"><code>
basic.showString("Hello World")
    </code></pre>
</div>

<p>Render the Fibonacci example:</b></p>

<div class="boxdiv">
    <pre class="blocks"><code>
let f1 = 0
let f2 = 0
let fibo = 0
fibo = 1
for (let i = 0; i < 10; i++) {
    basic.showNumber(fibo)
    basic.pause(1000)
    f2 = f1
    f1 = fibo
    fibo = f1 + f2
}
    </code></pre>
</div>

<p>The Fibonacci example not rendered:</p>

<div class="boxdiv">
    <pre><code>
let f1 = 0
let f2 = 0
let fibo = 0
fibo = 1
for (let i = 0; i < 10; i++) {
    basic.showNumber(fibo)
    basic.pause(1000)
    f2 = f1
    f1 = fibo
    fibo = f1 + f2
}
    </code></pre>
</div>

<script>
var makecodeUrl = "@homeurl@";
var blocksClass = "blocks";

var injectRenderer = function () {
    var f = $("<iframe>", {
        id: "makecoderenderer",
        src: makecodeUrl + "--docs?render=1&lang=" + ($('html').attr('lang') || "en")
    });
    f.css("position", "absolute");
    f.css("left", 0);
    f.css("bottom", 0);
    f.css("width", "1px");
    f.css("height", "1px");
    $('body').append(f);
}

function makeCodeRenderPre(pre) {
    var f = document.getElementById("makecoderenderer");
    f.contentWindow.postMessage({
        type: "renderblocks",
        id: pre.id,
        code: pre.innerText
    }, "@homeurl@");
}

var attachBlocksListener = function () {
    var blockId = 0;
    window.addEventListener("message", function (ev) {
        var msg = ev.data;
        if (msg.source != "makecode") return;

        switch (msg.type) {
            case "renderready":
                $("." + blocksClass).each(function () {
                    var snippet = $(this)[0];
                    snippet.id = "pxt-blocks-" + (blockId++);
                    makeCodeRenderPre(snippet);
                });
                break;
            case "renderblocks":
                var svg = msg.svg; // this is a string containing SVG
                var id = msg.id;   // this is the id you sent
                // replace text with svg
                var img = document.createElement("img");
                img.src = msg.uri;
                img.width = msg.width;
                img.height = msg.height;
                var pre = document.getElementById(id)
                pre.parentNode.insertBefore(img, pre)
                pre.parentNode.removeChild(pre);
                break;
        }
    }, false);
}

$(function () {
    injectRenderer();
    attachBlocksListener();
});
</script>
</body>
</html>
```

## Rendering shared projects

Rendering a shared project is accomplished in almost the same manner as the embedded blocks method. In this case though,
leave the ``code`` attribute empty and pass the shared project id in a ``options.packageId`` data field.

In the HTML, you can store the shared project id in a ``pre`` element as a data attribute.

```
<pre data-packageid="_HjWJo9eHjXwP"></pre>
```

Then, read the ``data-packageid`` attribute and pass it along as the ``packageId`` field in the ``options`` of the ``renderblocks`` message.

```
f.contentWindow.postMessage({
    type: "renderblocks",
    id: pre.id,
    code: "",
    options: {
    	packageId: pre.getAttribute("data-packageid")
    }
}, "@homeurl@");
```

* [HTML only](https://jsfiddle.net/L8msdjpu/3/)

## Lazy loading

You can detect whether you have any snippet on your page before loading the rendering ``iframe``.
