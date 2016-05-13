# Deploying PXT with static files

There are multiple ways to deploy your PXT target.
* upload to pxt.io --- this is currently only supported for internal Microsoft targets
* publish your target to NPM and then require users to do ``pxt target yourtarget`` and 
  ``pxt serve``
* generate static HTML/JS/CSS files and host them on HTTP server of your choosing (free
  GitHub Pages will do nicely)

This documentation page deals with the last option.

## Manual file generation

Running ``pxt staticpkg`` will create a number of files under ``built/packaged``.
These can be served as is using any web server. You can use ``pxt serve -pkg``.

You can also run ``pxt staticpkg foo``, which will create files under ``built/packaged/foo``
that assume they sit under `/foo/` on the web server. If you do not specify anything,
the files assume they sit right under `/`. To test it, run `pxt server -pkg` and head to
`http://localhost:3232/foo/index.html`.

## [GitHub Pages](https://pages.github.com/) support

GitHub provides you with free hosting for your project files.

If you have not yet setup `gh-pages` branch, run `pxt ghpinit` from your target 
repository root. This will create a fresh checkout `built/gh-pages` and create 
`gh-pages` branch.

When you already have the `gh-pages` branch, you can just run `pxt ghppush`.
This will:
* create a fresh checkout in `built/gh-pages` if needed
* implicityly run `pxt staticpkg repo-name`
* copy files from `built/packaged/repo-name` to `built/gh-pages`
* add files to git, commit, and push

You can then head to `https://your-username.github.io/repo-name/`.

## Multiple targets

It is possible to host multiple editors under the same pages domains.