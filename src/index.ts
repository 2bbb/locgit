import path from 'path';

import { app, Tray, Menu, BrowserWindow, nativeTheme, nativeImage } from 'electron';

let tray: Tray | null = null;
let window: BrowserWindow | null = null;

const createTrayIcon = async () => {
    let icon_path: string | null = null;
    console.log(process.platform);
    if(process.platform === 'win32') {
        icon_path = path.join(__dirname, '../resources/git-white.ico');
    } else {
        if(nativeTheme.shouldUseDarkColors){
            icon_path = path.join(__dirname, '../resources/git-white.png');
        } else {
            icon_path = path.join(__dirname, '../resources/git-black.png');
        }
    }
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Quit', role: 'quit' }
    ]);
    const icon = nativeImage.createFromPath(icon_path);
    tray = new Tray(icon);
    tray.setToolTip(app.name);
    tray.setContextMenu(contextMenu);

    if(process.platform === 'darwin') { 
        nativeTheme.on("updated", () => {
            if(nativeTheme.shouldUseDarkColors){
                const icon = nativeImage.createFromPath(path.join(__dirname, '../resources/git-white.png'));
                tray?.setImage(icon);
            } else {
                const icon = nativeImage.createFromPath(path.join(__dirname, '../resources/git-black.png'));
                tray?.setImage(icon);
            }
        });
    }
};

app.whenReady().then(() => {
    // createWindow();
    createTrayIcon();
});

import { Git } from 'node-git-server';

const port = !process.env.PORT || isNaN(parseInt(process.env.PORT))
    ? 7005
    : parseInt(process.env.PORT);

const repos = new Git(path.join(__dirname, '../repo'), {
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
    console.log(`gitectron running at http://localhost:${port}`);
});
