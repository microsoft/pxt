# Micro:bit UI test 

This is the selenium UI test for Micro:bit.

## Download and Build

1. Clone the PXT git repository
2. Install Chrome browser in local machine.
3. Download ChromeDriver from https://sites.google.com/a/chromium.org/chromedriver/downloads. The downloaded file is a zip file. Extract it and place the executable in a folder in your PATH.
4. Open folder tests/ui-test 
5. Install required node.js modules for the selenium test

```
npm install
```

## Run in command line

```
npm test
```

## Run and Debug in VS Code

1. Open VS Code 
2. Open project `ui-test` folder in VS Code
3. Click `Debug`
4. Choose `Mocha Tests` in Debug
5. Click `Start Debugging`

