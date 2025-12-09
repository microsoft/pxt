## Deploying the skillmap
`gulp skillmap` in the main `pxt` directory will build the skillmap. This is part of the default `gulp` command, and runs with our build, but you can also run it separately; the command builds the skillmap and copies the generated `index.html` file into `webap/public` as `skillmap.html`, as well as coping all the built JS and CSS files into `built/web/skillmap`.

## Building the skillmap locally
Run `pxt skillmap --serve` in the target directory to build and serve the skillmap locally. This command copies the appropriate built files (`pxtlib.js`, `target.js`, `semantic.css`, `icons.css`, `react-common-skillmap.css`) into your local skillmap directory to serve, so you may also need to run the appropriate build commands to generate those files.

When running locally, the skillmap iframe will load `localhost:3232`, so you will need to run `pxt serve` in the target directory to load activities. Make sure you have the local token stored in the browser session (you can do this by loading the URL with the localtoken one in a separate tab).

Use the `?nolocalhost=1` flag to load the default content for the skillmap.

To test local markdown files, use `pxt skillmap --docs . --serve`, and reference them under docs e.g. `http://localhost:3000/#docs:/skillmap/bug-arena`

## Loading skillmap content
The skillmap can render markdown from Github or from our docs. The format is:

- `#github:[organization name]/[repository name]/[markdown file name]`
- `#docs:[relative path to file]` eg `/skillmap/beginner-skillmap`
