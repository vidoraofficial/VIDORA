const {
  contextBridge,
  ipcRenderer,
} = require('electron')

/*
 * Only expose the small set of capabilities
 * that VIDORA actually needs.
 *
 * No Node.js APIs, filesystem APIs, shell APIs,
 * or arbitrary IPC access are exposed to React.
 */

contextBridge.exposeInMainWorld(
  'desktop',
  {
    async chooseFolder() {
      return ipcRenderer.invoke(
        'dialog:choose-folder',
      )
    },
  },
)