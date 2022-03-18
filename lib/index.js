"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_git_server_1 = require("node-git-server");
const path_1 = __importDefault(require("path"));
const port = !process.env.PORT || isNaN(parseInt(process.env.PORT))
    ? 7005
    : parseInt(process.env.PORT);
const repos = new node_git_server_1.Git(path_1.default.join(__dirname, '../repo'), {
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
repos.listen(port, { type: 'http' }, () => {
    console.log(`node-git-server running at http://localhost:${port}`);
});
const electron_1 = require("electron");
let tray = null;
let window = null;
const createTrayIcon = async () => {
    let icon_path = null;
    console.log(process.platform);
    if (process.platform === 'win32') {
        icon_path = path_1.default.join(__dirname, '../resources/git-white.ico');
    }
    else {
        if (electron_1.nativeTheme.shouldUseDarkColors) {
            icon_path = path_1.default.join(__dirname, '../resources/git-white.png');
        }
        else {
            icon_path = path_1.default.join(__dirname, '../resources/git-black.png');
        }
    }
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { label: 'Quit', role: 'quit' }
    ]);
    const icon = electron_1.nativeImage.createFromPath(icon_path);
    tray = new electron_1.Tray(icon);
    tray.setToolTip(electron_1.app.name);
    tray.setContextMenu(contextMenu);
    if (process.platform === 'darwin') {
        electron_1.nativeTheme.on("updated", () => {
            if (electron_1.nativeTheme.shouldUseDarkColors) {
                const icon = electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, '../resources/git-white.png'));
                tray === null || tray === void 0 ? void 0 : tray.setImage(icon);
            }
            else {
                const icon = electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, '../resources/git-black.png'));
                tray === null || tray === void 0 ? void 0 : tray.setImage(icon);
            }
        });
    }
};
function createWindow() {
    window = new electron_1.BrowserWindow({
        width: 400,
        height: 400,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        webPreferences: {
        // backgroundThrottling: false
        }
    });
    window.loadURL(`file://${path_1.default.join(__dirname, '../resources/index.html')}`);
    // Hide the window when it loses focus
    window === null || window === void 0 ? void 0 : window.hide();
    electron_1.app.dock.hide();
}
electron_1.app.whenReady().then(() => {
    // createWindow();
    createTrayIcon();
});
//# sourceMappingURL=index.js.map