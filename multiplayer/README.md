# MakeCode Multiplayer Project

This app allows users to play a MakeCode Arcade game together in online multiplayer.

## First-time dev setup

This doc assumes you have a functioning pxt development environment. Refer here for setup instructions: https://github.com/microsoft/pxt-arcade#local-dev-setup 

## Developing

1. In the pxt folder, run `gulp build` or `gulp watch` to ensure latest changes to `pxtlib`, `react-common`, and other dependencies are built.
1. In the pxt-arcade folder, run `pxt serve --rebundle`. This will serve the main Arcade webapp. *This is required for sign-in to work on localhost.*
1. In the pxt-arcade folder, in another terminal, run `pxt multiplayer --docs .`. This will start the multiplayer app dev server.
1. You're all set. Go forth and develop.


Notes:
* The app will hot-reload as you make code changes. Pretty neat!
* If your css changes aren't appearing, run `pxt buildcss` in the pxt-arcade folder and it should refresh.
* Debugging with breakpoints is best done in the browser's developer console. Look for the sources under `top/localhost:3000/static/js/<your repo root>/pxt/multiplayer`
