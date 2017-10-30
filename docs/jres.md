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

The `sounds.jres` file contains the data. The file has a special `*` key, specifies
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
