# Routing

The PXT documentation supports a basic file structure and allows inheritance of pages from various repos and remixes them into a final document.

## File structure

PXT assumes that the documentation is located under the ``/docs`` folder. The web site routing follows this file structure:

```
/about -> /docs/about.md
/reference/math -> /docs/reference/math.md
```

Static assets such as pictures can be placed under the ``/docs/static`` folder.

## Inheriting docs

Targets will inherit main PXT docs for common language features, but can override parts of each document. 

By default, all upstream PXT docs are visible in the target. They consist mostly of the language reference. If a target defines a document with a name matching an upstream document, the target's
version will be used. If the target's version includes macro ```# @extends```, then the upstream
version is used as the base document and the sections it wants to extend are overridden.

Sections are overridden based on matching their ids. For example, a target's version of
the document above can look like:

```markdown
# @​extends
### #ex2
My example
## See Also These! #also
My links
```

The resulting markdown will end up as:

```markdown
## Examples #ex
### Example 1
...
### Example 2 #ex2
My example
### Example 3
...
## See Also These! #also
My links
```

If the title of section is omitted, the title from the upstream version is taken.

Only named sections of the upstream document can be overridden. This is to avoid
possible mixups related to localization.

Do not introduce new section ids in the target's document - they will appear as errors at the end.
Also, if you were to override a section with nested subsections, like the `ex` section above,
it is not necessary to specify nested subsections again (i.e., `#ex2` can be skipped).

The sections in the upstream document are treated as a tree, following the nesting level
of the headers. In the target document, a section spans from the beginning of a section with
an id, up to the next section with an id. That is, the tree structure is not required.

## Docs file lookup

The lookup of path `https://some.domain.com/v2/foo/bar` proceeds as follows:
* take the main repo of the target corresponding to `some.domain.com` at branch `v2`
* check if any of `docs/foo/bar-ref.json` or `docs/foo/bar.html` exist; if so use it and stop
* check for `docs/foo/bar.md`
* if it exists and doesn't contain `# @extends` use it and stop
* for every bundled package `P` from `pxtarget.json`, that is not in
  `pxt-common-packages`, look for `P/docs/foo/bar.md`; if found use it and stop (no expansion here)
* get `package.json` and `pxtarget.json` from the main target repo
* check for base file `common-docs/foo/bar.md` in the checkout of `pxt-core` branch from `package.json`;
  eg `"dependencies": { "pxt-core": "3.2.1" }` will result in looking into `pxt-core` repo at `v3` branch
* if it fails, then for every bundled package `P` from `pxtarget.json` look for base file in the checkout of
  `pxt-common-packages` (version from `package.json`) for `P/docs/foo/bar.md`
* if no base file is found, server response is 404
* otherwise, either serve the base file as is, or patch it up using the instructions 
  in [Inheriting docs](#inheriting-docs) above

If there is, say, no `v7` branch of a repo but the `package.json` at `master` has `"version": "7.3.1"`,
then `master` is used instead of `v7`.

The lookup of path `https://some.domain.com/foo/bar`, where `foo` doesn't look like
`v0`, `v1`, etc., proceeds like above but with `master` instead of `v2`.

If the page is requested in a non-English language, the `.md` files are first fetched
from Crowdin on the same branch as they would have been fetched from the repo (either `master` 
or `vN`).

To see how this resolution applies in a particular target,
you can try to load an non-existing URL - the error page will show you the list of locations
tried. You may need to click a little 'More info' button to see it.

