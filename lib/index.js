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
        {
            label: `Open list of repositories on browser`,
            click() {
                electron_1.shell.openExternal('http://localhost:8080/');
            }
        },
        { label: 'Quit', role: 'quit' },
    ]);
    tray === null || tray === void 0 ? void 0 : tray.setContextMenu(contextMenu);
}
const moment_1 = __importDefault(require("moment"));
const logs = [];
function push_log(log) {
    logs.push(`${(0, moment_1.default)().format('YYYY/MM/DD hh:mm:ss')}: ${log}`);
    while (10 < logs.length) {
        logs.shift();
    }
    if (tray) {
        tray.setToolTip(`${electron_1.app.name} is running.\n---- ---- ---- ----\n${logs.join("\n")}`);
    }
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
    tray.setToolTip(`${electron_1.app.name} is running.\n---- ---- ---- ----\nno activity.`);
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
const child_process_1 = require("child_process");
const pretty_format = "[%h] %ci: \\\"%s\\\" by %an";
function setupRepository() {
    const repos = new node_git_server_1.Git(settings.repository_path, {
        autoCreate: true,
    });
    function get_address_str(duplex) {
        const address = duplex.socket.address();
        if (address.address) {
            return `\n  from ${address.address}`;
        }
        else {
            return '\n  from unknown';
        }
    }
    repos.on('push', (push) => {
        const dir = repos.dirMap(`${push.repo}.git`);
        push.accept();
        const latest_commit_message = (0, child_process_1.execSync)(`git log -1 --pretty="${pretty_format}"`, {
            cwd: dir
        }).toString();
        const log = `pushed: ${push.repo}#${push.branch} [ ${push.commit} ]${get_address_str(push)}\n${latest_commit_message}`;
        console.log(log);
        push_log(log);
    });
    repos.on('fetch', (fetch) => {
        const log = `fetched: ${fetch.repo} [ ${fetch.commit} ]${get_address_str(fetch)}`;
        console.log(log);
        push_log(log);
        fetch.accept();
    });
    repos.on('tag', (tag) => {
        const log = `tag: "${tag.version}" ${tag.repo} [ ${tag.commit} ]${get_address_str(tag)}`;
        console.log(log);
        push_log(log);
        tag.accept();
    });
    // repos.on('info', (info: InfoData) => {
    //     const log = `info: ${info.repo}${get_address_str(info)}`;
    //     console.log(log);
    //     push_log(log);
    //     info.accept();
    // });
    repos.on('head', (head) => {
        const log = `head: ${head.repo}${get_address_str(head)}`;
        console.log(log);
        push_log(log);
        head.accept();
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
const express_1 = __importDefault(require("express"));
const express_app = (0, express_1.default)();
// respond with "hello world" when a GET request is made to the homepage
express_app.get('/', (req, res) => {
    res.sendFile('index.html', { root: resource_dir });
});
express_app.get('/repositories.json', async (req, res) => {
    try {
        const repositories = await (await repos.list()).map(repo => {
            const dir = repos.dirMap(`${repo}`);
            const logs = [0, 1, 2, 3, 4].map((n) => {
                const command = `git log -1 --skip=${n} --pretty="${pretty_format}"`;
                try {
                    const log = (0, child_process_1.execSync)(command, {
                        cwd: dir
                    }).toString();
                    return log;
                }
                catch (err) {
                    return undefined;
                }
            }).filter(log => log != '' && log != null);
            return { name: repo, logs };
        });
        res.status(200).json({ repositories, port: settings.port });
    }
    catch (err) {
        res.status(500).send(err.toString());
    }
});
express_app.listen(8080, '0.0.0.0', () => {
    console.log('http server on port 8080');
});
//# sourceMappingURL=index.js.map