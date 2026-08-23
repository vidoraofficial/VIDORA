const {
  contextBridge,
  ipcRenderer,
} = require('electron')

/*
 * Only expose the small set of capabilities
 * that VIDORA actually needs.
 *
 * No Node.js APIs, filesystem APIs,
 * shell APIs, or arbitrary IPC access
 * are exposed to React.
 */

contextBridge.exposeInMainWorld(
  'desktop',
  {
    async chooseFolder() {
      return ipcRenderer.invoke(
        'dialog:choose-folder',
      )
    },

    async checkForUpdates() {
      return ipcRenderer.invoke(
        'updater:check',
      )
    },

    async installUpdate() {
      return ipcRenderer.invoke(
        'updater:install',
      )
    },

    async getVersion() {
      return ipcRenderer.invoke(
        'app:get-version',
      )
    },

    onUpdaterEvent(callback) {
      if (
        typeof callback !==
        'function'
      ) {
        return () => {}
      }

      const handler = (
        event,
        payload,
      ) => {
        callback(payload)
      }

      ipcRenderer.on(
        'updater:event',
        handler,
      )

      return () => {
        ipcRenderer.removeListener(
          'updater:event',
          handler,
        )
      }
    },
  },
)