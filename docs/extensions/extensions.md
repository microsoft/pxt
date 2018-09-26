# Editor extensions

An editor extension may have an associated editor extension hosted in the Github Pages section of the repo.

* [pxt-neoanim](https://github.com/Microsoft/pxt-neoanim) is an example of specialized NeoPixel animation editor.

## Configuration

The editor extension is configured in the [pxt.json](/extensions/pxt-json) file by adding an ``extension`` field:

```typescript-ignore
{
    ...
    extension: {}
}
```

The editor will automatically add an "Editor" button for the editor extension in the extensions category. 

## Protocol

The editor and the editor extension &lt;iframe&gt; communicate using a protocol of IFrame messages. 

* Messages have a unique ``id`` to correlate responses to requests.
* A ``response`` message can be requested. The ``id`` identifer can be used to correlate a receive response to the original query.
* All messages sent by the editor extension must contain the extension id, ``extId``. This identifier is passed when loading the &lt;iframe&gt; (see [Initialization](#initialization)).

```typescript-ignore
// sending message
var msg = {
    id: Math.random().toString(),
    type: "pxtpkgext",
    action: "extinit",
    extId: extId,
    response: true
}
window.parent.postMessage(msg, "*");

// handle the response
function receivedResponse(resp) {
  if (resp.action === "extinit")
    console.log('initialized!')
}
window.addEventListener("message", function(ev) {
  var resp = ev.data;
  if (resp && resp.type === "pxtpkgext")
    receivedResponse(resp);
}, false);
```

### Initialization

When the user presses the editor extension button:

* The GitHub pages site is loaded in an &lt;iframe&gt; with an extension id in the hashmark, e.g. https://microsoft.github.io/pxt-neoanim/#extid for the extension https://github.com/Microsoft/pxt-neoanim.

### ~ hint

Store the extension id since it's needed in every message.

```typescript-ignore
var extId = window.location.hash.substr(1);
```

### ~

* Once fully loaded, the extension sends a ``extinit`` message to the parent window.

```typescript-ignore
var msg = {
    id: Math.random().toString(),
    type: "pxtpkgext",
    action: "extinit",
    extId: extId
}
...
```

### Shown / Hidden events

The editor sends a ``extshown`` message when showing the editor frame, and a ``exthidden`` message after hiding the editor.

### Read and Write code

The editor extension can read (``extreadcode``) and write (``extwritecode``) a dedicated TypeScript and JSON file in the project. The JSON file is designed to store rich metadata while the TypeScript is the "code behind" that gets executed. This feature does not require permissions.

#### Write code

```typescript-ignore
var msg = {
    id: Math.random().toString(),
    type: "pxtpkgext",
    action: "extwritecode",
    extId: extId,
    body: {
        code: "// generated TypeScript code",
        json: "serialized JSON here"
    }
}
...
```

#### Read code

```typescript-ignore
var id = Math.random().toString();
var msg = {
    id: id,
    type: "pxtpkgext",
    action: "extreadcode",
    extId: extId,
    response: true
}
...

function receivedResponse(resp) {
  if (resp.action === "extreadcode" && resp.id === id && resp.body) {
      var ts = resp.body.code;
      var json = JSON.parse(resp.body.json);
      ...
  }
}
...
```

### Read and Write user code

The ``extusercode`` message requests to read the entire set of files in the project. The user will be prompted to give permission. If successfull, the response contains a ``resp`` field with a map of the file names to file contents.

```typescript-ignore
export interface UserCodeResponse extends ExtensionResponse {
    /* A mapping of file names to their contents */
    resp?: { [index: string]: string };
}
```

### Data streams

When available, the editor may stream data coming from the devices. The ``extdatastream`` message requests to stream data. The user will be prompted to give permission. The following message sets a request for serial messages:

```typescript-ignore
var msg {
    ...
    action: "extdatastream",
    body: {
        serial: true
    }
}
...
```

If successful, the editor will proxy serial messages to the editor &lt;iframe&gt;.