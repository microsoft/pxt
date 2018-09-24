# Extension Release Tests

These release tests apply to editor that support GitHub extensions.

## All approved packages compile

* open a command prompt with Git and pxt CLI installed
* run

```
pxt testghpkgs
```

If you get throttled,

* login with your PXT token from https://makecode.com/oauth/get-token

```
pxt login pxt TOKEN
```

* login with a GitHub token

```
pxt login github TOKEN
```