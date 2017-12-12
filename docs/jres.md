# Embedding resources in projects

Let's say you want to add some sound resources.

In `mysounds.ts` you put definitions of constants for all sounds. You pass an empty
hex literal to the constructor - it will be replaced with the data from `sounds.jres`
file, based on the `jres=...` annotation. The `jres=...` also implies `whenUsed`, ie., the
sound object will only be created if it is actually referenced from somewhere.

```typescript-ignore
namespace sfx {
    //% fixedInstance jres=sounds.bark
    export const bark = new Sound(hex ``) 
    //% fixedInstance jres=sounds.purr
    export const purr = new Sound(hex ``) 
}
```

The `sounds.jres` file contains the data. The file has a special `*` key, which specifies
default metadata for other keys. The rest of keys specify resources.

```json
{
    "*": {
        "namespace": "sounds",
        "dataEncoding": "base64",
        "mimeType": "audio/wav"
    },
    "bark": {
        "data": "CiAgICAiYnVpbHQvcHh0cGFydHMu...IsCiAgICAic",
        "icon": "data:image/png,base64:dHMiLAogICAgI...93ZWIvd"
    },
    "purr": {
        // ...
    }
}
```

Currently, only `base64` is supported as data encoding. If you skip `dataEncoding` in the `.jres` file,
it will now and in future default to `base64`.


## Short forms

In case, there's only the `"data"` field present, the file can be shortened:

```json
{
    "*": {
        "namespace": "images",
        "dataEncoding": "base64",
        "mimeType": "image/png"
    },
    "eyes": "CiAgICAiYnVpbHQvcHh0cGFydHMu...IsCiAgICAic",
    "smile": "dHMiLAogICAgI...93ZWIvd"
}
```

In case where the `jres` name matches the namespace and name of the constant,
it can be omitted, as in:

```typescript-ignore
namespace images {
    //% fixedInstance jres
    export const eyes = new Image(hex ``) 
}
```

## Building JRES files

The [command line](/cli) provides a command, ``buildjres`` that will automatically expand files into a jres resource.

* create a jres file with empty resources

```
{
    "*": {
        "namespace": "sounds",
        "dataEncoding": "base64",
        "mimeType": "audio/wav"
    },
    "bark": {},
    "purr": {}
}
```

* Under the same project, create a subfolder ``jres/RESOURCENAME`` where ``RESOURCENAME`` is the name of your jres file.
* Place all the files that need to be included with the names ``RESOURCE-icon.png`` for icons, and ``RESOURCE-data.EXT`` for data, where ``ext`` is determine by the mime type of the resource.