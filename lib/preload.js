"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    send(channel, data) {
        electron_1.ipcRenderer.send(channel, data);
    },
    on(channel, func) {
        electron_1.ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
};
electron_1.contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.js.map