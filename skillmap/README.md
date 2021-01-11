## Deploying the skillmap
`gulp skillmap` in the main `pxt` directory will build the skillmap. This is part of the default `gulp` command, and runs with our build, but you can also run it separately; the command builds the skillmap and copies the generated `index.html` file into `webap/public` as `skillmap.html`, as well as coping all the built JS and CSS files into `built/web/skillmap`.

## Building the skillmap locally
Run `pxt skillmap --serve` in the target directory to build and serve the skillmap locally. This command copies the appropriate built files (`pxtlib.js`, `target.js`, `semantic.css`) into your local skillmap directory to serve, so you may also need to run the appropriate build commands to generate those files.

Use the `?nolocalhost=1` flag to load the default content for the skillmap.