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
        { label: 'Quit', role: 'quit' },
        { type: 'separator' },
        { label: `How To Use: git remote add locgit http://XX.XX.XX.XX:${settings.port}/{YOUR_REPO_NAME}`, type: 'normal' },
    ]);
    tray?.setContextMenu(contextMenu);
}

const createTrayIcon = async () => {
    let icon_path: string | null = null;
    console.log(process.platform);
    if(process.platform === 'win32') {
        icon_path = path.join(resource_dir, 'git-white.ico');
    } else {
        if(nativeTheme.shouldUseDarkColors){
            icon_path = path.join(resource_dir, 'git-white.png');
        } else {
            icon_path = path.join(resource_dir, 'git-black.png');
        }
    }
    const icon = nativeImage.createFromPath(icon_path);
    tray = new Tray(icon);
    tray.setToolTip(`${app.name} is running.`);
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

import { Git } from 'node-git-server';
import { electron } from 'process';

function setupRepository(): Git {
    const repos = new Git(settings.repository_path, {
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