## Deploying authcode
`gulp authcode` in the main `pxt` directory will build the authcode project. This is part of the default `gulp` command, and runs with our build, but you can also run it separately; the command builds authcode and copies the generated `index.html` file into `webap/public` as `authcode.html`, as well as coping all the built JS and CSS files into `built/web/authcode`.

## Building authcode locally
Run `pxt authcode` in the target directory to build and serve the authcode project locally. This command copies the appropriate built files (`pxtlib.js`, `target.js`, `semantic.css`, `icons.css`, `react-common-authcode.css`) into your local authcode directory to serve, so you may also need to run the appropriate build commands to generate those files.
