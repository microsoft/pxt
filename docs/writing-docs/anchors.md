# Anchors

Sections of document can be named by adding ``#some-name`` after a section header.
These will be used as the `id` attribute of the corresponding `<hX>` tag, so they
can be used in links.
For example:

```markdown
## Examples #ex
### Example 1
...
### Example 2 #ex2
...
### Example 3
...
## See also #also
...
```

This will result in:

```html
<h2 id='ex'>Examples</h2>
<h3>Example 1</h3>
...
<h3 id='ex2'>Example 2</h3>
...
<h3>Example 3</h3>
...
<h2 id='also'>See also</h2>
...
```

Sections stretch until a header with the same or smaller number
of `#` in front is found. This isn't relevant for plain HTML, but
matters when overriding sections (see below).

Thus, the section named `ex` contains Examples 1, 2, and 3.
Section `ex2` contains only Example 2,
and section `also` contains the See also paragraph.
