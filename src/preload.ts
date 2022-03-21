import { contextBridge, ipcRenderer } from 'electron';

const api = {
    send(channel: string, data: any) {
        ipcRenderer.send(channel, data);
    },
    on(channel: string, func: (... args: any[]) => any) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
};

contextBridge.exposeInMainWorld(
    "api", api
);
