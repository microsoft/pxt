# Kiosk

## config.json settings

These settings apply only to the kiosk user experience and do not impact sim gameplay. It's assumed all gamepads use the same configuration.

|Key|Purpose|
|---------------------------------|-|
|GameDataUrl                      | Path to the game data JSON file with details about the games to include.|
|PlayUrlRoot                      | Left part of the embedded player URL up to and including --run.|
|HighScoresToKeep                 | The maximum number of high scores to keep for a given game.|
|HighScoreInitialsLength          | The number of initials to allow users to enter.|
|HighScoreInitialAllowedCharacters| The list and order of characters to allow in high scores.|
|GamepadPollLoopMilli             | How often the gamepads are polled for user interaction with the kiosk menus and other inputs. If this is too large, actions may be missed, such as a quick button press. If it's too small, then a single action may be interpretted as multiple (like a single button press counting twice).|
|GamepadCacheMilli                | How often the gamepad state is cached. Since multiple components access the browser's Navigator.getGamepads() API, we use a caching mechanism to optimize how often they're accessed. This value should be smaller than the gamepad polling loop.|
|GamepadAButtonPin                | The pin index for the A button. |
|GamepadBButtonPin                | The pin index for the B button.|
|GamepadEscapeButtonPin           | The pin index for the Escape button. This button leaves a game without waiting and returns the user to the menu.|
|GamepadResetButtonPin            | The pin index for the Reset button.|
|GamepadMenuButtonPin             | The pin index for the Menu button. Note that since this menu is used by games, it does not return the user to the kiosk menu. |
|GamepadLeftRightAxis             | The gamepad axis index for left/right detection.|
|GamepadLeftRightThreshold        | The threshold to detect for a "right" action. It's negated to detect "left" actions.|
|GamepadUpDownAxis                | The gamepad axis index for up/down detection.|
|GamepadUpDownThreshold           | The threshold to detect for a "down" action. It's negated to detect "up" actions.|
|Keyboard`Input`Keys              | Each is an array of string arrays matching the browser keys that map to the target behavior. The index of a list maps to the same gamepad index (player 1 is the first array at index 0, etc.) |

## Localhost testing

To test Kiosk locally:

1. Ensure your pxt repo is up to date and has been built recently.
2. In a command shell, in the `pxt` repo, cd into the `kiosk` folder and start the Kiosk dev server: `npm run start`. This will *not* open a browser window.
3. In another command shell, in the `pxt-arcade` repo, start the Arcade dev server: `pxt serve --rebundle`. This will open the Arcade webapp in a browser.

Requests to the `/kiosk` endpoint will be routed to the Kiosk dev server.

Debug and step through Kiosk code using the browser dev tools (F12 to open).


## Test in staging environment

1. In the pxt repo, run `gulp` to ensure production kiosk is built.
2. In a browser, go to `https://staging.pxt.io/oauth/gettoken`. This should return a url with an auth token embedded. Copy the entire url value to your clipboard.
   - It should look something like `https://staging.pxt.io/?access_token=X.XXXXXXXX`
   - If you get access denied, contact your manager to help you.
3. In a command shell, set environment variable `PXT_ACCESS_TOKEN` with the copied value.
4. In the same shell, in the pxt-arcade repo, run `pxt uploadtrg --rebundle`. This should return a url to your private build.
   - It should look something like `https://arcade.staging.pxt.io/app/XXXXXX-XXXXX`
 - Paste in a browser and append "/kiosk". This should take you to your kiosk build in staging.

## Test in production environment

Follow the "Test in staging environment" instructions, but get your auth token from `https://makecode.com/oauth/gettoken`.


## Authoring UI sound effects

1. Open the "Kiosk Audio Effects" project in Arcade: https://makecode.com/_K6AfE6AWd9xV
   - Click on the provided link to open the MakeCode Arcade project in your web browser.

2. Tweak or add the desired sound:
   - Within the MakeCode Arcade project, modify or add the sound effect you want.

3. Play the sound in the editor a few times while capturing the audio:
   - Install a Chrome extension called "Chrome Audio Capturer" from this link: [Link to Chrome Audio Capturer](https://github.com/arblast/Chrome-Audio-Capturer)
   - Use the extension to capture the audio of the sound effect by playing it within the MakeCode editor.

4. In a sound file editor, clip out the sound effect and export it as .ogg:
   - Download the captured audio file.
   - Open a sound file editor (such as Audacity or Adobe Audition).
   - Import the downloaded audio file.
   - Edit and clip out the specific sound effect you want.
   - Run a high-pass filter to reduce volume of low-end frequencies.
   - Export the edited audio as an .ogg file.

5. Save the .ogg file to /pxt/docs/kiosk-data/sfx:
   - Navigate to the specified directory (/pxt/docs/kiosk-data/sfx) in your file system.
   - Save the edited .ogg sound effect file in this directory.

6. If it's a new effect, add it to Services/SoundEffectService.ts:
   - If the sound effect you added or modified is new and hasn't been used before, you may need to update the code in the `Services/SoundEffectService.ts` file to include the new sound effect.

7. Re-share the above project and update the URL in Step 1:
   - Share the MakeCode Arcade project with the updated sound effect, ensuring is it not saved as a Persistent Share.
   - Update the URL in Step 1 of these instructions to reflect the new project URL.

