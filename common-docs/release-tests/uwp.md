# Windows App

Make sure you navigate to /beta!

## Home screen

* [ ] Make sure tab navigation gives you hidden menus 
    * [ ] Make sure the hidden menu items work as expected
* [ ] Make sure the carousels work 
    * [ ] Using mouse drag
    * [ ] Using arrow buttons
    * [ ] Using Tab / enter
* [ ] Test import 
    * [ ] URL
    * [ ] File
* [ ] Test partner link in top-left
* [ ] Test MakeCode link in top-right

## Examples and tutorials

* [ ] Open a few examples
* [ ] Open a few tutorials 
    * [ ] Make sure they load
    * [ ] Make sure they decompile (show the hint)
    * [ ] Make sure the step navigation bar works
    * [ ] Make sure you can exit the tutorial and keep your current code (it will be in a new project)

## Simulator

* [ ] Test the various controls 
    * [ ] Play / Stop
    * [ ] Restart
    * [ ] Snail (make sure you see the code being highlighted as it's running)
    * [ ] Mute / Unmute
    * [ ] Full screen
* [ ] Test the various sensor simulators 
    * [ ] Button A, B, A + B
    * [ ] Gesture (shake)
    * [ ] Sound sensor
    * [ ] Light sensor
    * [ ] Switch
    * [ ] Acceleration (you can tilt the device around)
* [ ] Test various Neopixel animations and ShowRing configurations to make sure the Neopixels work
* [ ] Test various melodies and tones

## Localization

* [ ] Change the language and make sure things are translated
Toolbox
* [ ] Test keyboard navigation of categories
* [ ] Make sure categories don'T take too long to open
* [ ] Test search 
    * [ ] Make sure built-in blocks (if, for, math operators, true/false, etc) can show up in search
    * [ ] Test search while localized; make sure you can search localized terms and find appropriate results
    * [ ] Try searching for localized built-in blocks
Workspace
* [ ] Try dragging blocks, snapping / unsnapping, moving stack of blocks, popping out a stack of block, popping out a single block (ctrl + drag) 
    * [ ] Try it with touch
* [ ] Try deleting blocks, undo / redo, duplicate
* [ ] Try zoom in / zoom out
* [ ] Try dragging canvas 
    * [ ] Try with touch
* [ ] Try keyboard shortcuts: Delete, Ctrl-Z, Ctrl-Shift-Z, Ctrl-C / Ctrl-V, Ctrl-Wheel
* [ ] Try pinch to zoom (touch)

## Blocks

* [ ] Try all different kinds of blocks
* [ ] Try all sorts of field editors

## Flashing

* [ ] Make sure flashing succeeds in following scenarios: 
    * [ ] Disconnect device, close app, connect device while in bootloader, open app, flash
    * [ ] Disconnect device, close app, connect device while not in bootloader, open app, flash
    * [ ] Disconnect device, close app, open app, connect device while in bootloader, flash
    * [ ] Disconnect device, close app, open app, connect device while not in bootloader, flash
    * [ ] Launch app, connect device in bootloader, disconnect device, switch to not bootloader, connect device, flash
    * [ ] Test other similar scenarios of closing / launching / minimizing app, both while device is and isn't in bootloader mode
* [ ] Disconnect the device and try to flash: 
    * [ ] Make sure the troubleshooting dialog pops up
    * [ ] Make sure you can click the "Troubleshoot" button and it takes you to the relevant page
    * [ ] Make sure you can download the file by clicking the download button in that dialog

## Serial

The following project is useful to test serial: https://makecode.com/_Tj9eTqLk2Xza

Open it to test the sim serial, and flash it on a device to test device serial

* [ ] Simulator serial 
    * [ ] Pres A to toggle X Acceleration data logging on / off, and make sure it's logged in the graph view
    * [ ] Press B to send a console message and make sure it is logged in the console view
* [ ] Device serial 
    * [ ] Pres A to toggle X Acceleration data logging on / off, and make sure it's logged in the graph view
    * [ ] Press B to send a console message and make sure it is logged in the console view
    * [ ] Disconnect & reconnect the device while Acceleration is being logged, and make sure serial still works
    * [ ] Disconnect & reconnect the device while Acceleration is not being logged, toggle logging on using A, and make sure serial still works
    * [ ] Start logging Acceleration with button A, minimize the app, wait for a few seconds, maximize app and make sure serial is still working / you can still flash the device when you resume
    * [ ] Start logging Acceleration with button A, put the computer to sleep, then wake up and make sure serial is still working / you can still flash the device when you resume
