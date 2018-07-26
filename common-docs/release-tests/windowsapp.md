# Windows App

Make sure you navigate to /beta! in windows app.

## Editor testing

Repeat editor testing as noted here: [Editor Test Plan](/release-tests/editor)

## Flashing

* Make sure flashing succeeds in following scenarios: 
    1. Disconnect device, close app, connect device while in bootloader, open app, flash
    2. Disconnect device, close app, connect device while not in bootloader, open app, flash
    3. Disconnect device, close app, open app, connect device while in bootloader, flash
    4. Disconnect device, close app, open app, connect device while not in bootloader, flash
    5. Launch app, connect device in bootloader, disconnect device, switch to not bootloader, connect device, flash
    6. Test other similar scenarios of closing / launching / minimizing app, both while device is and isn't in bootloader mode
*  Disconnect the device and try to flash: 
    1. Make sure the troubleshooting dialog pops up
    2. Make sure you can click the "Troubleshoot" button and it takes you to the relevant page
    3. Make sure you can download the file by clicking the download button in that dialog

## Serial

The following project is useful to test serial: https://makecode.com/_Tj9eTqLk2Xza

Open it to test the sim serial, and flash it on a device to test device serial

* Simulator serial 
  1. Pres A to toggle X Acceleration data logging on / off, and make sure it's logged in the graph view
  2.  Press B to send a console message and make sure it is logged in the console view
* Device serial 
    1. Pres A to toggle X Acceleration data logging on / off, and make sure it's logged in the graph view
    2. Press B to send a console message and make sure it is logged in the console view
    3. Disconnect & reconnect the device while Acceleration is being logged, and make sure serial still works
    4. Disconnect & reconnect the device while Acceleration is not being logged, toggle logging on using A, and make sure serial still works
    5. Start logging Acceleration with button A, minimize the app, wait for a few seconds, maximize app and make sure serial is still working / you can still flash the device when you resume
    6. Start logging Acceleration with button A, put the computer to sleep, then wake up and make sure serial is still working / you can still flash the device when you resume

## Additional Tests

* [Test Plan](/testplan)