'use strict';
const fs = require('fs')
const path = require('path')
const electron = require('electron');
const child_process = require('child_process');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function copyFile(source, target) {
    var rd = fs.createReadStream(source);
    rd.on("error", done);

    var wr = fs.createWriteStream(target);
    wr.on("error", done);
    wr.on("close", function (ex) {
        done();
    });
    rd.pipe(wr);

    function done(err) {
        console.log(err);
    }
}

function deployHexFile(file) {
    if (process.platform == "win32") {
        child_process.exec("wmic PATH Win32_LogicalDisk get DeviceID, VolumeName, FileSystem", function (error, stdout, stderr) {
            let drives = []
            stdout.split(/\n/).forEach(ln => {
                let m = /^([A-Z]:).*\s*MICROBIT/.exec(ln)
                if (m) drives.push(m[1])
            })

            drives.forEach(function (drive) {
                copyFile(file, path.join(drive, "firmware.hex"));
            })
        })
    }
}

function downloadAndDeployHexFile(event, item, webContents) {
    if (item.getMimeType() != "application/x-microbit-hex") return;
    let downoads = app.getPath("downloads") + "/pxt";
    if (!fs.existsSync(downoads)) fs.mkdirSync(downoads);
    let fpath = path.join(downoads, item.getFilename());
    console.log('saving to ' + fpath)
    item.setSavePath(fpath);
    item.on('updated', function () {
        console.log('Received bytes: ' + item.getReceivedBytes());
    });
    item.on('done', function (e, state) {
        if (state == "completed")
            deployHexFile(fpath);
    });
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false
        },
        title: "Programming Experience Toolkit"
    });
    mainWindow.setMenu(null)
    mainWindow.webContents.session.on('will-download', downloadAndDeployHexFile)

    // and load the index.html of the app.
    mainWindow.loadURL('http://localhost:3232');

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});