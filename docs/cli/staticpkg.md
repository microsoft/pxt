# pxt-staticpkg Manual Page

### @description Compiles PXT editor into static HTML files

Packages the target into static HTML pages

```
pxt staticpkg [--route route] [--githubpages] [--output output]
```

## Description

Compiles the PXT editor into static HTML files that can be served without a server or integrated into an app. The resulting files are placed in ``built/packaged``.

## Flags:

### route <value> (optional)

Routing path. If missing, defaults to ``local``. The route will be injected into the all the paths in the application.

### githubpages (optional)

Generate a web site compatible with GitHub pages.

### output (optional)

Directory for generated files. 

### bump (option)

Bump version number generating pages

### ~ hint

This directory is cleaned before starting the process.

### ~


## Deploying PXT with static files

Running ``pxt staticpkg`` will create a number of files under ``built/packaged``.
You can use ``pxt serve -pkg`` or any other any web server. For example, you can use [http-server](https://www.npmjs.com/package/http-server) for easy testing.

```
npm install -g http-server
http-server -c-1 built/packaged
```

You can also run ``pxt staticpkg --route foo``, which will create files under ``built/packaged/foo``
that assume they sit under `/foo/` on the web server. If you do not specify anything,
the files assume they sit right under `/`. To test it, run `pxt serve -pkg` and head to
`http://localhost:3232/foo/index.html`.

## [GitHub Pages](https://pages.github.com/) support

GitHub provides you with free hosting for your project files.

If you wish to publish your web site to GitHub pages, simply add ``--githubpages`` to the command.

This will:
* create a fresh checkout in `built/gh-pages` if needed
* implicitly run `pxt staticpkg --route repo-name`
* copy files from `built/packaged/repo-name` to `built/gh-pages`
* add files to git, commit, and push

You can then head to `https://your-username.github.io/repo-name/`.
