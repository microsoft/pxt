# pxt-staticpkg Manual Page

### @description Compiles PXT editor into static HTML files

Packages the target into static HTML pages

```
pxt staticpkg [--route route] [--githubpages]
```

## Description

Compiles the PXT editor into static HTML files that can be served without a server or integrated into an app. The resulting files are placed in ``built/packaged``.

## Flags:

### route <value> (optional)

Output directory and routing path. If missing, defaults to ``local``. The route will be injected into the all the paths in the application.

### githubpages (optional)

Generate a web site compatiable with GitHub pages.

## Local testing

After running the command, mount a web server from serves ``/<div>`` to the ``built/package/<dir>`` folder. You can use [http-server](https://www.npmjs.com/package/http-server) for easy testing.

```
npm install -g http-server
http-server -c-1 built/packaged
```

## See Also

[pxt](/cli) tool
