"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
let tray = null;
let window = null;
function sendApi(channel, args) {
    if (!window)
        return;
    window.webContents.send('init-response', settings);
}
const resource_dir = path_1.default.join(__dirname, '../resources');
const default_settings = {
    port: 18080,
    repository_path: path_1.default.join(electron_1.app.getPath('home'), 'locgit_repositories'),
};
const settings_path = path_1.default.join(electron_1.app.getPath('userData'), 'settings.json');
function isValidSettings(settings) {
    return typeof settings === 'object' &&
        typeof settings.port === 'number' &&
        typeof settings.repository_path === 'string';
}
function saveSettings() {
    fs_1.default.writeFileSync(settings_path, JSON.stringify(settings, null, 4));
}
if (!fs_1.default.existsSync(settings_path)) {
    fs_1.default.writeFileSync(settings_path, JSON.stringify(default_settings, null, 4));
}
const settings_json = JSON.parse(fs_1.default.readFileSync(settings_path, 'utf8'));
const settings = isValidSettings(settings_json) ? settings_json : default_settings;
function setContextMenu() {
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: `Open locgit settings`,
            click() {
                if (window)
                    window.show();
                else
                    openSettingWindow();
            }
        },
        { label: 'Quit', role: 'quit' },
        { type: 'separator' },
        { label: `How To Use: git remote add locgit http://XX.XX.XX.XX:${settings.port}/{YOUR_REPO_NAME}`, type: 'normal' },
    ]);
    tray === null || tray === void 0 ? void 0 : tray.setContextMenu(contextMenu);
}
const createTrayIcon = async () => {
    let icon_path = null;
    console.log(process.platform);
    if (process.platform === 'win32') {
        icon_path = path_1.default.join(resource_dir, 'git-black.ico');
    }
    else {
        if (electron_1.nativeTheme.shouldUseDarkColors) {
            icon_path = path_1.default.join(resource_dir, 'git-white.png');
        }
        else {
            icon_path = path_1.default.join(resource_dir, 'git-black.png');
        }
    }
    const icon = electron_1.nativeImage.createFromPath(icon_path);
    tray = new electron_1.Tray(icon);
    tray.setToolTip(`${electron_1.app.name} is running.`);
    setContextMenu();
    if (process.platform === 'darwin') {
        electron_1.nativeTheme.on("updated", () => {
            if (electron_1.nativeTheme.shouldUseDarkColors) {
                const icon = electron_1.nativeImage.createFromPath(path_1.default.join(resource_dir, 'git-white.png'));
                tray === null || tray === void 0 ? void 0 : tray.setImage(icon);
            }
            else {
                const icon = electron_1.nativeImage.createFromPath(path_1.default.join(resource_dir, 'git-black.png'));
                tray === null || tray === void 0 ? void 0 : tray.setImage(icon);
            }
        });
        electron_1.app.dock.hide();
    }
};
function openSettingWindow() {
    if (window != null)
        return;
    window = new electron_1.BrowserWindow({
        width: 400,
        height: 300,
        useContentSize: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        title: 'locgit setting',
        hasShadow: false,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js')
        },
    });
    window.webContents.loadFile(path_1.default.join(resource_dir, 'setting.html'));
    window.on('closed', () => {
        window = null;
    });
}
electron_1.app.whenReady().then(() => {
    createTrayIcon();
});
electron_1.app.on('window-all-closed', (e) => {
    e.preventDefault();
});
const node_git_server_1 = require("node-git-server");
function setupRepository() {
    const repos = new node_git_server_1.Git(settings.repository_path, {
        autoCreate: true,
    });
    repos.on('push', (push) => {
        console.log(`push ${push.repo}/${push.commit} ( ${push.branch} )`);
        push.accept();
    });
    repos.on('fetch', (fetch) => {
        console.log(`fetch ${fetch.commit}`);
        fetch.accept();
    });
    repos.listen(settings.port, { type: 'http' }, () => {
        console.log(`gitectron running at http://localhost:${settings.port}`);
    });
    return repos;
}
let repos = setupRepository();
electron_1.ipcMain.on('init-request', (e) => {
    sendApi('init-response', settings);
});
electron_1.ipcMain.on('apply', (e, { port, repository_path }) => {
    if (Number.isInteger(port) && 1024 <= port && port <= 65535) {
        settings.port = port;
    }
    else {
        sendApi('alert', `invalid port: ${port}`);
        return;
    }
    settings.repository_path = repository_path;
    try {
        if (!fs_1.default.existsSync(repository_path)) {
            fs_1.default.mkdirSync(repository_path);
        }
    }
    catch (err) {
        sendApi('alert', `invalid repositries path: ${repository_path}`);
        return;
    }
    repos.close();
    repos = setupRepository();
    setContextMenu();
    saveSettings();
});
electron_1.ipcMain.on('open-website', async () => {
    try {
        await electron_1.shell.openExternal('https://github.com/2bbb/locgit');
    }
    catch (err) {
        console.error('Error:', err);
        sendApi('alert', 'failed to open https://github.com/2bbb/locgit\n' + err.toString());
    }
});
//# sourceMappingURL=index.js.map