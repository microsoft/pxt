# MakeCode Multiplayer Project

This app allows users to play a MakeCode Arcade game together in online multiplayer.

## First-time dev setup

This doc assumes you have a functioning pxt development environment. Refer here for setup instructions: https://github.com/microsoft/pxt-arcade#local-dev-setup 

## Developing

1. In the `pxt` folder, run `gulp build` or `gulp watch` to ensure latest changes to `pxtlib`, `react-common`, and other dependencies are built.
1. *If you need authentication:* In the `pxt-arcade` folder, run `pxt serve --rebundle`. This will serve the main Arcade webapp. *This is required for sign-in to work on localhost.*
  * This is because the app will try to read the auth token from the cli listening on `localhost:3232`.
1. In another terminal, in the `pxt-arcade` folder, run `pxt multiplayer --docs .`. This will start the multiplayer app dev server.
1. You're all set. Go forth and develop.


### Notes:
* The app will hot-reload as you make code changes. Pretty neat!
* If your css changes aren't appearing, run `pxt buildcss --force` in the `pxt-arcade` folder and it should refresh.
* Debugging with breakpoints is best done in the browser's developer console.
  * Look for sources under `top/localhost:3000/static/js/<local folder path>/pxt/multiplayer/src`
* Dependencies shared with `react-common` are sourced from the root `node_modules` folder, and are therefore not specified as production dependencies in this project's `package.json`. This is to avoid multiple instances of stateful libraries getting loaded (`react` and `react-dom`, namely).
  * This is accomplished using a workaround supplied by the `react-app-alias-ex` package.
