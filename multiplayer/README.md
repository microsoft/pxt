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


## Localhost testing

To test Multiplayer locally:

1. Ensure your pxt repo is up to date and has been built recently.
2. In a command shell, in the `pxt` repo, cd into the `multiplayer` folder and start the multiplayer dev server: `npm run start`. This will *not* open a browser window.
3. In another command shell, in the `pxt-arcade` repo, start the Arcade dev server: `pxt serve --rebundle`. This will open the Arcade webapp in a browser.

Requests to the `/--multiplayer` endpoint will be routed to the multiplayer dev server.

Debug and step through Multiplayer client code using the browser dev tools (F12 to open).


### Committing changes

Prior to committing code changes, run `npm run prettier` to ensure a measure of stylistic consistency. It is fine to include unrelated changes prettier makes elsewhere in the codebase when you run it.

Prettier VSCode plugin: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode


### Guidance for UI Controls

All UI controls (Buttons, Labels, Checkboxes) should be sourced from the `react-common` project in this repo.


### Guidance for UI Layout

This project uses [Tailwind CSS](https://tailwindcss.com/) for all layout and ad-hoc styling (flexbox, margins, paddings, etc). There should be no need to create custom one-off CSS classes for individual divs. If you find you're duplicating the same Tailwind composition over and over, guidance is to extract it to a component. If that isn't viable, it can be moved to a CSS class using `@apply`: https://tailwindcss.com/docs/reusing-styles#extracting-classes-with-apply

The Tailwind docs will be your good friend: https://tailwindcss.com/docs/

The Tailwind CSS IntelliSense VSCode plugin is also very handy: https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss


### Misc Notes
* The app will hot-reload as you make code changes. Pretty neat!
* If your css changes aren't appearing, or styles look broken, run `pxt buildcss` in the `pxt-arcade` folder and it should refresh.
* Dependencies shared with `react-common` are sourced from the root `node_modules` folder, and are therefore not specified as production dependencies in this project's `package.json`. This is to avoid multiple instances of stateful libraries getting loaded (`react` and `react-dom`, namely).
  * This is accomplished using a workaround supplied by the `react-app-alias-ex` package.
