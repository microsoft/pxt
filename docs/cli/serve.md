# pxt-serve Manual Page

### @description Serve a local web server for the editor

Serve a local web server for the editor

```
pxt serve
```

## Options

### localbuild

Force build native images with local tooling

### browser <chrome|ie|firefox|safari> 

Set the browser to launch on web server start

### noBrowser 

Start the server without launching a browser

### noSerial 

do not monitor serial devices

### sourceMaps 

Include source maps when building ts files

### pkg 

Serve packaged

### cloud

forces build to happen in the cloud

### just

just serve without building

### hostname

hostname to run serve, default localhost

### port

port to bind server, default 3232

### wsport

port to bind websocket server, default 3233

### backport

port where the locally running backend is listening

### https

use https protocol instead of http

### noauth

disable localtoken-based authentication

### localRepo <owner/repo=dir>

Serve a GitHub repository from a local directory instead of GitHub. Can be given more than once, and overrides entries of `pxtlocal.json` for the same repository.

## Description

The local web server is meant for development purposes.

### Serving GitHub extensions from local directories

While developing an extension against a local target, you can have the editor load it from your local checkout instead of GitHub. Add a `pxtlocal.json` file at the root of the target checkout, mapping each GitHub repository to a local directory (absolute, or relative to the target checkout):

```json
{
    "localRepos": {
        "owner/pxt-banana": "../pxt-banana"
    }
}
```

The file holds paths of your machine, so keep it out of source control. For a one-off run, use ``pxt serve --local-repo owner/pxt-banana=../pxt-banana`` instead (relative to the directory you start the server from); the flag can be repeated and overrides the file.

The server lists each alias when it starts. Any extension from an aliased repository then resolves from the local directory, including extensions in subfolders, such as ``https://github.com/owner/pxt-banana/extensions/peel``, which resolves from ``../pxt-banana/extensions/peel``. Other repositories are loaded from GitHub as usual.

* **Any version resolves to your files.** Whatever version a project asks for, the editor loads the current files in the local directory. Adding an aliased extension from the **Extensions** dialog adds it without a version, for example ``"banana": "github:owner/pxt-banana"``.
* **Nothing is cached.** Reload the editor to pick up changes to the extension's files.
* **Missing packages are errors.** If an aliased repository has no ``pxt.json`` at the requested path, or a file it lists is missing, the server reports the missing path in its console and the editor fails to load the extension. It does not fall back to GitHub.
* **Local only.** Aliases apply only to the editor served on localhost, and the server answers alias requests behind the same authentication as the rest of its local API: open the editor with the URL the server prints (it carries the ``local_token``, which the editor then remembers), or start the server with ``--noauth`` to turn that authentication off on a development machine. Aliased repositories are treated as approved extensions.

Run the server with ``--debug`` to see each file request it answers from a local directory.

## See Also

[pxt](/cli) tool
