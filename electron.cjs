const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require('electron')

const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

const APP_ID = 'com.vidora.desktop'
const APP_TITLE = 'VIDORA'

const gotSingleInstanceLock =
  app.requestSingleInstanceLock()

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

if (!gotSingleInstanceLock) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
let backendProcess = null

const isDev = !app.isPackaged

let updaterInitialized = false
let updateCheckInProgress = false
let updateDownloaded = false

/* =========================================================
   PATHS
========================================================= */

function getFrontendPath() {
  return path.join(
    __dirname,
    'dist',
    'index.html',
  )
}

function getBackendPath() {
  if (isDev) {
    return path.join(
      __dirname,
      'backend',
      'VideoDownloaderBackend.exe',
    )
  }

  return path.join(
    process.resourcesPath,
    'backend',
    'VideoDownloaderBackend.exe',
  )
}

function getIconPath() {
  return path.join(
    __dirname,
    'build',
    'vidora.ico',
  )
}

function getRendererIconURL() {
  const iconPath = getIconPath()

  if (!fs.existsSync(iconPath)) {
    return ''
  }

  try {
    return pathToFileURL(iconPath).href
  } catch {
    return ''
  }
}

/* =========================================================
   BACKEND
========================================================= */

function startBackend() {
  if (backendProcess) {
    return
  }

  const backendPath =
    getBackendPath()

  if (!fs.existsSync(backendPath)) {
    console.error(
      '[VIDORA] backend not found:',
      backendPath,
    )

    return
  }

  console.log(
    '[VIDORA] starting backend:',
    backendPath,
  )

  backendProcess = spawn(
    backendPath,
    [],
    {
      windowsHide: true,
      detached: false,
      stdio: 'ignore',
    },
  )

  backendProcess.on(
    'error',
    (error) => {
      console.error(
        '[VIDORA] backend error:',
        error,
      )

      backendProcess = null
    },
  )

  backendProcess.on(
    'exit',
    (code) => {
      console.log(
        '[VIDORA] backend exited:',
        code,
      )

      backendProcess = null
    },
  )
}

function stopBackend() {
  if (!backendProcess) {
    return
  }

  try {
    backendProcess.kill()
  } catch {
    // Already stopped.
  }

  backendProcess = null
}

/* =========================================================
   SECURITY
========================================================= */

function isMainWindowContents(contents) {
  return (
    mainWindow &&
    contents === mainWindow.webContents
  )
}

function isAllowedNavigation(url) {
  if (!url) {
    return false
  }

  try {
    const parsed = new URL(url)

    if (parsed.protocol === 'file:') {
      const frontendURL = new URL(
        `file://${getFrontendPath().replace(
          /\\/g,
          '/',
        )}`,
      )

      return (
        parsed.pathname ===
        frontendURL.pathname
      )
    }

    if (isDev) {
      return (
        parsed.hostname ===
          'localhost' ||
        parsed.hostname ===
          '127.0.0.1'
      )
    }

    return false
  } catch {
    return false
  }
}

/* =========================================================
   SIDEBAR / RENDERER BRANDING
========================================================= */

async function applyRendererBranding() {
  if (!mainWindow) {
    return
  }

  const iconURL =
    getRendererIconURL()

  if (!iconURL) {
    console.warn(
      '[VIDORA] Renderer icon file not found.',
    )

    return
  }

  const script = `
    (() => {
      const iconURL = ${JSON.stringify(
        iconURL,
      )}

      const logoImages = Array.from(
        document.querySelectorAll(
          'img[src="/vidora-sidebar-logo.png"], img[src$="vidora-sidebar-logo.png"]'
        )
      )

      for (const image of logoImages) {
        image.src = iconURL
      }

      if (!window.__VIDORA_LOGO_OBSERVER__) {
        const observer =
          new MutationObserver(() => {
            const images =
              document.querySelectorAll(
                'img[src="/vidora-sidebar-logo.png"], img[src$="vidora-sidebar-logo.png"]'
              )

            for (const image of images) {
              if (
                image.src !== iconURL
              ) {
                image.src = iconURL
              }
            }
          })

        observer.observe(
          document.documentElement,
          {
            childList: true,
            subtree: true,
          },
        )

        window.__VIDORA_LOGO_OBSERVER__ =
          observer
      }

      document
        .querySelectorAll(
          'img[alt="VIDORA"]',
        )
        .forEach((image) => {
          if (
            image.complete &&
            image.naturalWidth === 0
          ) {
            image.src = iconURL
          }
        })
    })()
  `

  try {
    await mainWindow.webContents.executeJavaScript(
      script,
      true,
    )

    console.log(
      '[VIDORA] renderer branding applied',
    )
  } catch (error) {
    console.warn(
      '[VIDORA] renderer branding failed:',
      error,
    )
  }
}

/* =========================================================
   UPDATE IPC STATE
========================================================= */

function sendUpdateEvent(
  event,
  payload = {},
) {
  if (!mainWindow) {
    return
  }

  if (
    mainWindow.webContents.isDestroyed()
  ) {
    return
  }

  mainWindow.webContents.send(
    'updater:event',
    {
      event,
      ...payload,
    },
  )
}

/* =========================================================
   AUTO UPDATER
========================================================= */

function initializeAutoUpdater() {
  if (
    updaterInitialized ||
    isDev
  ) {
    return
  }

  updaterInitialized = true

  /*
   * We want the VIDORA React page to control
   * when an update check happens.
   */
  autoUpdater.autoDownload = true

  /*
   * Do not unexpectedly install while the user
   * is working. React will explicitly request
   * installation after update-downloaded.
   */
  autoUpdater.autoInstallOnAppQuit = false

  /*
   * electron-updater's GitHub provider will use
   * the publish configuration from package.json.
   */
  autoUpdater.on(
    'checking-for-update',
    () => {
      updateCheckInProgress = true

      sendUpdateEvent(
        'checking-for-update',
      )
    },
  )

  autoUpdater.on(
    'update-available',
    (info) => {
      updateCheckInProgress = true

      sendUpdateEvent(
        'update-available',
        {
          version:
            info?.version ||
            null,
        },
      )
    },
  )

  autoUpdater.on(
    'update-not-available',
    (info) => {
      updateCheckInProgress = false
      updateDownloaded = false

      sendUpdateEvent(
        'update-not-available',
        {
          version:
            info?.version ||
            null,
          currentVersion:
            app.getVersion(),
        },
      )
    },
  )

  autoUpdater.on(
    'download-progress',
    (progress) => {
      sendUpdateEvent(
        'download-progress',
        {
          percent:
            Number.isFinite(
              progress?.percent,
            )
              ? progress.percent
              : 0,

          bytesPerSecond:
            progress?.bytesPerSecond ||
            0,

          total:
            progress?.total ||
            0,

          transferred:
            progress?.transferred ||
            0,
        },
      )
    },
  )

  autoUpdater.on(
    'update-downloaded',
    (info) => {
      updateCheckInProgress = false
      updateDownloaded = true

      sendUpdateEvent(
        'update-downloaded',
        {
          version:
            info?.version ||
            null,
        },
      )
    },
  )

  autoUpdater.on(
    'update-cancelled',
    (info) => {
      updateCheckInProgress = false
      updateDownloaded = false

      sendUpdateEvent(
        'update-cancelled',
        {
          version:
            info?.version ||
            null,
        },
      )
    },
  )

  autoUpdater.on(
    'error',
    (error) => {
      updateCheckInProgress = false

      console.error(
        '[VIDORA] updater error:',
        error,
      )

      sendUpdateEvent(
        'error',
        {
          message:
            error?.message ||
            'Update failed.',
        },
      )
    },
  )

  console.log(
    '[VIDORA] auto updater initialized',
  )
}

/* =========================================================
   UPDATE IPC HANDLERS
========================================================= */

ipcMain.handle(
  'updater:check',
  async () => {
    if (isDev) {
      return {
        status: 'disabled-in-development',
        version:
          app.getVersion(),
      }
    }

    if (updateCheckInProgress) {
      return {
        status: 'checking',
        version:
          app.getVersion(),
      }
    }

    try {
      const result =
        await autoUpdater.checkForUpdates()

      if (!result) {
        return {
          status:
            'unavailable',
          version:
            app.getVersion(),
        }
      }

      const available =
        Boolean(
          result.updateInfo &&
            result.updateInfo.version &&
            result.updateInfo.version !==
              app.getVersion(),
        )

      return {
        status:
          available
            ? 'available'
            : 'current',

        currentVersion:
          app.getVersion(),

        availableVersion:
          result
            ?.updateInfo
            ?.version ||
          null,
      }
    } catch (error) {
      console.error(
        '[VIDORA] update check failed:',
        error,
      )

      return {
        status: 'error',
        message:
          error?.message ||
          'Could not check for updates.',
      }
    }
  },
)

ipcMain.handle(
  'updater:install',
  async () => {
    if (isDev) {
      return {
        status:
          'disabled-in-development',
      }
    }

    if (!updateDownloaded) {
      return {
        status:
          'not-downloaded',
      }
    }

    try {
      /*
       * This restarts VIDORA and launches the
       * downloaded NSIS update installer.
       */
      autoUpdater.quitAndInstall(
        false,
        true,
      )

      return {
        status: 'installing',
      }
    } catch (error) {
      console.error(
        '[VIDORA] update install failed:',
        error,
      )

      return {
        status: 'error',
        message:
          error?.message ||
          'Could not install the update.',
      }
    }
  },
)

/*
 * Allow React to retrieve the current version
 * without exposing Node.js directly.
 */
ipcMain.handle(
  'app:get-version',
  () => app.getVersion(),
)

/* =========================================================
   WINDOW
========================================================= */

function createWindow() {
  if (mainWindow) {
    if (
      mainWindow.isMinimized()
    ) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()

    return
  }

  const iconPath =
    getIconPath()

  console.log(
    '[VIDORA] icon:',
    iconPath,
  )

  if (
    !fs.existsSync(iconPath)
  ) {
    console.warn(
      '[VIDORA] icon not found:',
      iconPath,
    )
  }

  mainWindow =
    new BrowserWindow({
      width: 1400,
      height: 900,

      minWidth: 1050,
      minHeight: 700,

      title: APP_TITLE,

      icon: iconPath,

      backgroundColor:
        '#05070a',

      frame: true,

      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,

      autoHideMenuBar: true,

      webPreferences: {
        preload: path.join(
          __dirname,
          'preload.cjs',
        ),

        contextIsolation: true,

        nodeIntegration: false,

        sandbox: true,

        webSecurity: true,

        allowRunningInsecureContent:
          false,

        devTools: isDev,
      },
    })

  if (
    process.platform === 'win32' &&
    fs.existsSync(iconPath)
  ) {
    try {
      mainWindow.setIcon(
        iconPath,
      )
    } catch (error) {
      console.warn(
        '[VIDORA] setIcon failed:',
        error,
      )
    }
  }

  mainWindow.setMenuBarVisibility(
    false,
  )

  /* =======================================================
     TITLE
  ======================================================= */

  mainWindow.webContents.on(
    'page-title-updated',
    (event) => {
      event.preventDefault()

      if (mainWindow) {
        mainWindow.setTitle(
          APP_TITLE,
        )
      }
    },
  )

  /* =======================================================
     NAVIGATION SECURITY
  ======================================================= */

  mainWindow.webContents.on(
    'will-navigate',
    (event, url) => {
      if (
        !isAllowedNavigation(url)
      ) {
        event.preventDefault()

        console.warn(
          '[VIDORA] blocked navigation:',
          url,
        )
      }
    },
  )

  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      console.warn(
        '[VIDORA] blocked new window:',
        url,
      )

      return {
        action: 'deny',
      }
    },
  )

  mainWindow.webContents.on(
    'will-redirect',
    (event, url) => {
      if (
        !isAllowedNavigation(url)
      ) {
        event.preventDefault()

        console.warn(
          '[VIDORA] blocked redirect:',
          url,
        )
      }
    },
  )

  if (!isDev) {
    mainWindow.webContents.on(
      'devtools-opened',
      () => {
        mainWindow?.webContents.closeDevTools()
      },
    )
  }

  /* =======================================================
     LOAD FRONTEND
  ======================================================= */

  const frontendPath =
    getFrontendPath()

  console.log(
    '[VIDORA] loading:',
    frontendPath,
  )

  if (
    !fs.existsSync(frontendPath)
  ) {
    dialog.showErrorBox(
      APP_TITLE,
      `Frontend not found:\n\n${frontendPath}`,
    )

    app.quit()
    return
  }

  mainWindow.loadFile(
    frontendPath,
  )

  /* =======================================================
     RENDERER EVENTS
  ======================================================= */

  mainWindow.webContents.on(
    'did-finish-load',
    async () => {
      if (!mainWindow) {
        return
      }

      mainWindow.setTitle(
        APP_TITLE,
      )

      if (
        process.platform === 'win32' &&
        fs.existsSync(iconPath)
      ) {
        try {
          mainWindow.setIcon(
            iconPath,
          )
        } catch {
          // Ignore refresh errors.
        }
      }

      await applyRendererBranding()

      setTimeout(() => {
        applyRendererBranding()
      }, 250)

      setTimeout(() => {
        applyRendererBranding()
      }, 1000)

      console.log(
        '[VIDORA] renderer loaded',
      )
    },
  )

  mainWindow.webContents.on(
    'did-fail-load',
    (
      event,
      errorCode,
      errorDescription,
      validatedURL,
    ) => {
      console.error(
        '[VIDORA] renderer failed:',
        errorCode,
        errorDescription,
        validatedURL,
      )
    },
  )

  mainWindow.on(
    'closed',
    () => {
      mainWindow = null
    },
  )
}

/* =========================================================
   FOLDER PICKER
========================================================= */

ipcMain.handle(
  'dialog:choose-folder',
  async () => {
    if (!mainWindow) {
      return null
    }

    try {
      const result =
        await dialog.showOpenDialog(
          mainWindow,
          {
            title:
              'Choose VIDORA download folder',

            defaultPath:
              app.getPath(
                'downloads',
              ),

            properties: [
              'openDirectory',
              'createDirectory',
            ],
          },
        )

      console.log(
        '[VIDORA] folder picker result:',
        result,
      )

      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error(
        '[VIDORA] folder picker error:',
        error,
      )

      return null
    }
  },
)

/* =========================================================
   SINGLE INSTANCE
========================================================= */

app.on(
  'second-instance',
  () => {
    if (!mainWindow) {
      createWindow()
      return
    }

    if (
      mainWindow.isMinimized()
    ) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  },
)

/* =========================================================
   APP START
========================================================= */

app.whenReady().then(() => {
  if (
    process.platform === 'win32'
  ) {
    app.setAppUserModelId(
      APP_ID,
    )
  }

  app.on(
    'web-contents-created',
    (event, contents) => {
      contents.on(
        'will-navigate',
        (
          navigationEvent,
          url,
        ) => {
          if (
            isMainWindowContents(
              contents,
            ) &&
            !isAllowedNavigation(
              url,
            )
          ) {
            navigationEvent.preventDefault()
          }
        },
      )
    },
  )

  startBackend()
  createWindow()

  /*
   * Initialize only after the Electron
   * application is ready and the window
   * exists.
   */
  initializeAutoUpdater()

  app.on(
    'activate',
    () => {
      if (
        BrowserWindow.getAllWindows()
          .length === 0
      ) {
        createWindow()
      }
    },
  )
})

/* =========================================================
   SHUTDOWN
========================================================= */

app.on(
  'before-quit',
  () => {
    stopBackend()
  },
)

app.on(
  'window-all-closed',
  () => {
    stopBackend()
    app.quit()
  },
)