import path from "path";
import fs from "fs";
import { format } from "url";
import { app, BrowserWindow, Menu, MenuItemConstructorOptions, session, shell } from "electron";
import { is } from "electron-util";
import ElectronStore from "electron-store";
import { AppSettings } from "@withonevision/omnihive-desktop-core/models/AppSettings";
import { IsHelper } from "@withonevision/omnihive-core/helpers/IsHelper";
import _ from "lodash";
import { ipcMain } from "electron-better-ipc";

// Variables
let store: ElectronStore;
let encryptionKey: string;
let splash: BrowserWindow;
let splashShowing: boolean = true;
let initialLaunchComplete = false;
let appSettings: AppSettings = new AppSettings();
const defaultSettingsSchema = new AppSettings();

// Settings checker
const checkShowAppWindow = (win: BrowserWindow | null) => {
    if (IsHelper.isNullOrUndefined(win) || IsHelper.isNullOrUndefined(appSettings)) {
        setTimeout(() => {
            checkShowAppWindow(win);
        }, 1000);
        return;
    }

    win.show();
    win.focus();
};

//Set up encryption key
const getNewEncryptionKey = (length: number) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
};

if (!fs.existsSync(path.join(app.getPath("userData"), "keys"))) {
    fs.mkdirSync(path.join(app.getPath("userData"), "keys"));
}

const keyStore = new ElectronStore({ cwd: path.join(app.getPath("userData"), "keys") });

if (IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(keyStore.get("master") as string)) {
    encryptionKey = getNewEncryptionKey(32);
    keyStore.set("master", encryptionKey);
} else {
    encryptionKey = keyStore.get("master") as string;
}

// Initiate settings
store = new ElectronStore({ encryptionKey });
const savedSettings = store.get("appSettings") as AppSettings;

if (IsHelper.isNullOrUndefinedOrEmptyStringOrWhitespace(savedSettings)) {
    appSettings = defaultSettingsSchema;
} else {
    appSettings = savedSettings;
}

if (is.development) {
    app.commandLine.appendSwitch("remote-debugging-port", "8315");
}

// Setup menu
const menuTemplate: MenuItemConstructorOptions[] = [];

if (is.macos) {
    menuTemplate.push({
        label: "OmniHive Desktop",
        submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
        ],
    });
}

menuTemplate.push({
    label: "File",
    submenu: [
        {
            label: "New Window",
            accelerator: "CommandOrControl+N",
            click: () => {
                createNewWindow();
            },
        },
        is.macos ? { role: "close" } : { role: "quit" },
    ],
});

if (is.macos) {
    menuTemplate.push({
        label: "Edit",
        submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            {
                label: "Speech",
                submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
        ],
    });
} else {
    menuTemplate.push({
        label: "Edit",
        submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "delete" },
            { type: "separator" },
            { role: "selectAll" },
        ],
    });
}

menuTemplate.push({
    label: "View",
    submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
    ],
});

if (is.macos) {
    menuTemplate.push({
        label: "Window",
        submenu: [
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
        ],
    });
} else {
    menuTemplate.push({
        label: "Window",
        submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    });
}

menuTemplate.push({
    role: "help",
    submenu: [
        {
            label: "Learn More",
            click: async () => {
                await shell.openExternal("https://electronjs.org");
            },
        },
    ],
});

// Set Menu
const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

// Set application icon
app.dock.setIcon(path.join(__dirname, "..", "..", "resources", "dock_icon.png"));

// App Management
const initializeApplication = () => {
    // Set up splash screen
    splash = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, "..", "..", "resources", "Application.icns"),
        resizable: false,
        center: true,
        closable: false,
        movable: false,
        frame: false,
        alwaysOnTop: true,
        show: true,
        transparent: true,
    });
    splash.loadFile(path.join(__dirname, "..", "..", "resources", "splash.html"));

    createNewWindow();
};

const createNewWindow = (): void => {
    // Create the browser window.
    let appWindow: BrowserWindow | null = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: true,
        show: false,
        resizable: true,
        fullscreenable: true,
        webPreferences: {
            allowRunningInsecureContent: true,
            contextIsolation: false,
            devTools: true,
            enableRemoteModule: true,
            nodeIntegration: true,
        },
    });

    // and load the index.html of the app.
    if (is.development) {
        appWindow.loadURL("http://localhost:9080");
    } else {
        appWindow.loadURL(
            format({
                pathname: path.join(__dirname, "index.html"),
                protocol: "file",
                slashes: true,
            })
        );
    }

    // Open the DevTools.
    if (is.development) {
        appWindow.webContents.openDevTools({ mode: "detach" });
    }

    appWindow.on("closed", () => {
        appWindow = null;
    });

    appWindow.webContents.on("devtools-opened", () => {
        appWindow!.focus();
    });

    appWindow.on("ready-to-show", () => {
        if (splashShowing === true) {
            splash.destroy();
            splashShowing = false;
        }

        checkShowAppWindow(appWindow);
    });

    appWindow.on("show", () => {
        if (initialLaunchComplete === false) {
            initialLaunchComplete = true;
        }
    });
};

// App Events
app.on("ready", () => {
    initializeApplication();

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [""],
            },
        });
    });
});

app.on("window-all-closed", () => {
    if (!is.macos) {
        app.quit();
    }
});

app.on("activate", () => {
    if (app.isReady() && BrowserWindow.getAllWindows().length === 0) {
        initializeApplication();
    }
});

// IPC Management
ipcMain.answerRenderer("renderer-changed-appSettings", (arg: AppSettings) => {
    if (_.isEqual(arg, appSettings) || IsHelper.isNullOrUndefined(arg)) {
        return;
    }

    appSettings = arg;
    store.set({ appSettings });
    console.log(`Main Process Received AppSettings Change`, arg);
});

ipcMain.answerRenderer("renderer-request-appSettings", () => {
    console.log(`Main Process Responded to AppSettings Request`, appSettings);
    return appSettings;
});
