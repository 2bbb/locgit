"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mime_types_1 = __importDefault(require("mime-types"));
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
                electron_1.shell.openExternal(`http://localhost:${settings.port}/`);
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
        setTimeout(() => {
            const latest_commit_message = (0, child_process_1.execSync)(`git log -1 --pretty="${pretty_format}"`, {
                cwd: dir
            }).toString();
            const log = `pushed: ${push.repo}#${push.branch} [ ${push.commit.slice(0, 8)} ]${get_address_str(push)}\n${latest_commit_message}`;
            console.log(log);
            push_log(log);
        }, 10);
    });
    repos.on('fetch', (fetch) => {
        const log = `fetched: ${fetch.repo} [ ${fetch.commit.slice(0, 8)} ]${get_address_str(fetch)}`;
        console.log(log);
        push_log(log);
        fetch.accept();
    });
    repos.on('tag', (tag) => {
        const log = `tag: "${tag.version}" ${tag.repo} [ ${tag.commit.slice(0, 8)} ]${get_address_str(tag)}`;
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
    // repos.on('head', (head: HeadData) => {
    //     const log = `head: ${head.repo}${get_address_str(head)}`;
    //     console.log(log);
    //     push_log(log);
    //     head.accept();
    // });
    repos.listen(settings.port, { type: 'http' }, () => {
        console.log(`locgit running at http://localhost:${settings.port}`);
    });
    const original_handle = repos.handle;
    repos.handle = (req, res) => {
        // console.log(req.headers, req.rawHeaders);
        if (req.rawHeaders.indexOf('Git-Protocol') != -1 || (req.headers['user-agent'] && /^git\//.test(req.headers['user-agent']))) {
            // console.log('to node-git-server handle');
            original_handle.apply(repos, [req, res]);
        }
        else {
            // console.log('to express handle');
            express_app(req, res);
        }
    };
    return repos;
}
let repos = setupRepository();
const express_1 = __importDefault(require("express"));
function setup_express() {
    const app = (0, express_1.default)();
    app.use(express_1.default.static(resource_dir));
    app.get('/', (req, res) => {
        res.sendFile('index.html', { root: resource_dir });
    });
    app.get('/:repo.git', async (req, res) => {
        res.redirect(`/repos/${req.params.repo}.git`);
    });
    app.get('/repos/:repo.git', async (req, res) => {
        const repo = req.params.repo;
        const dir = repos.dirMap(`${repo}.git`);
        if (fs_1.default.existsSync(dir)) {
            res.sendFile('detail.html', { root: resource_dir });
        }
        else {
            res.status(404).send('404: repository not found');
        }
    });
    app.get('/repos/:repo.git/:branch', async (req, res) => {
        const repo = req.params.repo;
        const branch = req.params.branch;
        const dir = repos.dirMap(`${repo}.git`);
        if (fs_1.default.existsSync(dir)) {
            res.sendFile('detail.html', { root: resource_dir });
        }
        else {
            res.status(404).send('404: repository not found');
        }
    });
    app.get('/repos/:repo.git/:branch/files/:filepath*', async (req, res) => {
        const repo = req.params.repo;
        const branch = req.params.branch;
        const filepath = req.params["filepath"] + req.params["0"];
        try {
            console.log(repo, branch, filepath, req.params);
            const command = `git show ${branch}:${filepath}`;
            const dir = repos.dirMap(`${repo}.git`);
            const data = (0, child_process_1.execSync)(command, {
                cwd: dir
            });
            const contentType = mime_types_1.default.contentType(path_1.default.basename(filepath)) || 'application/octet-stream';
            console.log(filepath, contentType);
            res.setHeader('content-type', contentType);
            res.send(data);
        }
        catch (err) {
            res.status(404).send(`404: file not found on branch: ${branch}, path: ${filepath}`);
        }
    });
    app.get('/list/repositories.json', async (req, res) => {
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
    app.get('/data/:repo.json', async (req, res) => {
        const repo = req.params.repo;
        const dir = repos.dirMap(`${repo}.git`);
        const branch = req.query.branch;
        if (fs_1.default.existsSync(dir)) {
            const logs = [...Array(10).keys()].map((n) => {
                const command = `git log -1 --skip=${n} --pretty="${pretty_format}" ${branch ? '--first-parent ' + branch : ''}`;
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
            const files = (0, child_process_1.execSync)(`git ls-tree -r --name-only ${branch !== null && branch !== void 0 ? branch : 'HEAD'}`, {
                cwd: dir
            }).toString().split('\n').filter(file => file != '');
            const branches = (0, child_process_1.execSync)(`git branch`, {
                cwd: dir
            }).toString().split('\n').filter(file => file != '');
            const tags = (0, child_process_1.execSync)(`git tag`, {
                cwd: dir
            }).toString().split('\n').filter(file => file != '');
            res.status(200).json({ name: repo, logs, files, branches, tags, branch: branch });
        }
        else {
            res.status(404).json({ error: 'repo not found' });
        }
    });
    return app;
}
const express_app = setup_express();
electron_1.ipcMain.on('init-request', (e) => {
    sendApi('init-response', settings);
});
function valid_port(port) {
    return Number.isInteger(port)
        && 1024 <= port
        && port <= 65535;
}
electron_1.ipcMain.on('apply', (e, { port, repository_path }) => {
    if (valid_port(port)) {
        settings.port = port;
    }
    else {
        sendApi('alert', `invalid port: ${port}`);
        return;
    }
    try {
        if (!fs_1.default.existsSync(repository_path)) {
            fs_1.default.mkdirSync(repository_path);
            settings.repository_path = repository_path;
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