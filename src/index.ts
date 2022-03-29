import path from 'path';
import fs from 'fs';

import {
    app,
    Tray,
    Menu,
    BrowserWindow,
    nativeTheme,
    nativeImage,
    ipcMain,
    shell
} from 'electron';

let tray: Tray | null = null;
let window: BrowserWindow | null = null;
function sendApi(channel: string, args: any) {
    if(!window) return;
    window.webContents.send('init-response', settings);
}

const resource_dir = path.join(__dirname, '../resources');
const default_settings = {
    port: 18080,
    repository_path: path.join(app.getPath('home'), 'locgit_repositories'),
};
const settings_path = path.join(app.getPath('userData'), 'settings.json');
type Settings = typeof default_settings;
function isValidSettings(settings: any): settings is Settings {
    return typeof settings === 'object' &&
        typeof settings.port === 'number' &&
        typeof settings.repository_path === 'string';
}
function saveSettings() {
    fs.writeFileSync(settings_path, JSON.stringify(settings, null, 4));
}

if(!fs.existsSync(settings_path)) {
    fs.writeFileSync(settings_path, JSON.stringify(default_settings, null, 4));
}
const settings_json = JSON.parse(fs.readFileSync(settings_path, 'utf8'));
const settings: Settings = isValidSettings(settings_json) ? settings_json : default_settings;

function setContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { 
            label: `Open locgit settings`, 
            click() {
                if(window) window.show();
                else openSettingWindow();
            }
        },
        { 
            label: `Open list of repositories on browser`,
            click() {
                shell.openExternal('http://localhost:8080/');
            }
        },
        { label: 'Quit', role: 'quit' },
    ]);
    tray?.setContextMenu(contextMenu);
}

import moment from 'moment';

const logs: string[] = [];
function push_log(log: string) {
    logs.push(`${moment().format('YYYY/MM/DD hh:mm:ss')}: ${log}`);
    while(10 < logs.length) {
        logs.shift();
    }
    if(tray) {
        tray.setToolTip(`${app.name} is running.\n---- ---- ---- ----\n${logs.join("\n")}`);

    }
}

const createTrayIcon = async () => {
    let icon_path: string | null = null;
    console.log(process.platform);
    if(process.platform === 'win32') {
        icon_path = path.join(resource_dir, 'git-black.ico');
    } else {
        if(nativeTheme.shouldUseDarkColors){
            icon_path = path.join(resource_dir, 'git-white.png');
        } else {
            icon_path = path.join(resource_dir, 'git-black.png');
        }
    }
    const icon = nativeImage.createFromPath(icon_path);
    tray = new Tray(icon);
    tray.setToolTip(`${app.name} is running.\n---- ---- ---- ----\nno activity.`);
    setContextMenu();

    if(process.platform === 'darwin') { 
        nativeTheme.on("updated", () => {
            if(nativeTheme.shouldUseDarkColors){
                const icon = nativeImage.createFromPath(path.join(resource_dir, 'git-white.png'));
                tray?.setImage(icon);
            } else {
                const icon = nativeImage.createFromPath(path.join(resource_dir, 'git-black.png'));
                tray?.setImage(icon);
            }
        });
        app.dock.hide();
    }
};

function openSettingWindow() {
    if(window != null) return;

    window = new BrowserWindow({
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
            preload: path.join(__dirname, 'preload.js')
        },
    });
    window.webContents.loadFile(path.join(resource_dir, 'setting.html'));
    window.on('closed', () => {
        window = null;
    });
}

app.whenReady().then(() => {
    createTrayIcon();
});

app.on('window-all-closed', (e: Event) => {
    e.preventDefault();
});

import { FetchData, Git, HeadData, HttpDuplex, InfoData, PushData, TagData } from 'node-git-server';
import { execSync } from 'child_process';

const pretty_format = "[%h] %ci: \\\"%s\\\" by %an";

function setupRepository(): Git {
    const repos = new Git(settings.repository_path, {
        autoCreate: true,
    });
    
    function get_address_str<T extends HttpDuplex>(duplex: T): string {
        const address = duplex.socket.address() as AddressInfo;
        if(address.address) {
            return `\n  from ${address.address}`;
        } else {
            return '\n  from unknown';
        }
    }

    repos.on('push', (push: PushData) => {
        const dir = repos.dirMap(`${push.repo}.git`);
        push.accept();
        setTimeout(() => {
            const latest_commit_message = execSync(`git log -1 --pretty="${pretty_format}"`, {
                cwd: dir
            }).toString();
            const log = `pushed: ${push.repo}#${push.branch} [ ${push.commit.slice(0, 8)} ]${get_address_str(push)}\n${latest_commit_message}`;
            console.log(log);
            push_log(log);
        }, 10);
    });
    
    repos.on('fetch', (fetch: FetchData) => {
        const log = `fetched: ${fetch.repo} [ ${fetch.commit.slice(0, 8)} ]${get_address_str(fetch)}`;
        console.log(log);
        push_log(log);
        fetch.accept();
    });

    repos.on('tag', (tag: TagData) => {
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
        console.log(`gitectron running at http://localhost:${settings.port}`);
    });
    return repos;
}

let repos = setupRepository();

ipcMain.on('init-request', (e: Electron.IpcMainEvent) => {
    sendApi('init-response', settings);
});

ipcMain.on('apply', (e: Electron.IpcMainEvent, { port, repository_path }: { port: number, repository_path: string }) => {
    if(Number.isInteger(port) && 1024 <= port && port <= 65535) {
        settings.port = port;
    } else {
        sendApi('alert', `invalid port: ${port}`);
        return;
    }
    settings.repository_path = repository_path;
    try {
        if(!fs.existsSync(repository_path)) {
            fs.mkdirSync(repository_path);
        }
    } catch(err) {
        sendApi('alert', `invalid repositries path: ${repository_path}`);
        return;
    }
    repos.close();
    repos = setupRepository();
    setContextMenu();
    saveSettings();
});

ipcMain.on('open-website', async () => {
    try {
        await shell.openExternal('https://github.com/2bbb/locgit');
    } catch(err: any) {
        console.error('Error:', err);
        sendApi('alert', 'failed to open https://github.com/2bbb/locgit\n' + err.toString());
    }
});

import express from "express";
import { AddressInfo } from 'net';

const express_app = express();

express_app.use(express.static(resource_dir));

express_app.get('/', (req, res) => {
    res.sendFile('index.html', { root: resource_dir });
})

express_app.get('/repositories.json', async (req, res) => {
    try {
        const repositories = await (await repos.list()).map(repo => {
            const dir = repos.dirMap(`${repo}`);
            const logs = [0, 1, 2, 3, 4].map((n) => {
                const command = `git log -1 --skip=${n} --pretty="${pretty_format}"`;
                try {
                    const log = execSync(command, {
                        cwd: dir
                    }).toString();
                    return log;
                } catch(err) {
                    return undefined;
                }
            }).filter(log => log != '' && log != null);
            return { name: repo, logs };
        });
        res.status(200).json({ repositories, port: settings.port });
    } catch(err) {
        res.status(500).send((err as any).toString());
    }
});

express_app.listen(8080, '0.0.0.0', () => {
    console.log('http server on port 8080');
});
