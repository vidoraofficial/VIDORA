const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require('electron')

const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const http = require('http')
const { URL } = require('url')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

const APP_ID = 'com.vidora.desktop'
const APP_TITLE = 'VIDORA'
const AUTH_PROTOCOL = 'vidora'
const AUTH_CALLBACK_PREFIX = 'vidora://auth/callback'

function getAuthCallbackFromArgv(argv = []) {
  return argv.find((value) => (
    typeof value === 'string' &&
    value.toLowerCase().startsWith(AUTH_CALLBACK_PREFIX)
  )) || null
}

let pendingAuthCallbackUrl = getAuthCallbackFromArgv(process.argv)

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

if (!gotSingleInstanceLock) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
let backendProcess = null
let frontendServer = null
let frontendOrigin = ''

const isDev = !app.isPackaged

let updaterInitialized = false
let updateCheckInProgress = false
let updateDownloaded = false

function registerAuthProtocol() {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      return app.setAsDefaultProtocolClient(
        AUTH_PROTOCOL,
        process.execPath,
        [path.resolve(process.argv[1])],
      )
    }

    return app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  } catch (error) {
    console.warn('[VIDORA] auth protocol registration failed:', error)
    return false
  }
}

function isValidAuthCallbackUrl(url) {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === `${AUTH_PROTOCOL}:` &&
      parsed.hostname === 'auth' &&
      parsed.pathname === '/callback'
    )
  } catch {
    return false
  }
}

async function deliverAuthCallback(url) {
  if (!isValidAuthCallbackUrl(url)) {
    return
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingAuthCallbackUrl = url
    return
  }

  const safeUrl = JSON.stringify(url)
  const script = `(() => {
    window.__VIDORA_AUTH_CALLBACK__ = ${safeUrl}
    window.dispatchEvent(new CustomEvent('vidora-auth-callback', { detail: ${safeUrl} }))
  })()`

  try {
    await mainWindow.webContents.executeJavaScript(script, true)
  } catch (error) {
    console.warn('[VIDORA] auth callback delivery failed:', error)
    pendingAuthCallbackUrl = url
  }
}

const initialAuthCallbackUrl = pendingAuthCallbackUrl
pendingAuthCallbackUrl = initialAuthCallbackUrl

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

function getRendererLogoPNG() {
  const iconPath = getIconPath()

  if (!fs.existsSync(iconPath)) {
    return null
  }

  try {
    const image = nativeImage.createFromPath(iconPath)
    if (image.isEmpty()) return null
    return image.toPNG()
  } catch (error) {
    console.warn('[VIDORA] Renderer logo conversion failed:', error)
    return null
  }
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

  const backendPath = getBackendPath()

  if (!fs.existsSync(backendPath)) {
    console.error('[VIDORA] backend not found:', backendPath)
    return
  }

  console.log('[VIDORA] starting backend:', backendPath)

  backendProcess = spawn(
    backendPath,
    [],
    {
      windowsHide: true,
      detached: false,
      stdio: 'ignore',
    },
  )

  backendProcess.on('error', (error) => {
    console.error('[VIDORA] backend error:', error)
    backendProcess = null
  })

  backendProcess.on('exit', (code) => {
    console.log('[VIDORA] backend exited:', code)
    backendProcess = null
  })
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
   LOCAL FRONTEND SERVER
========================================================= */

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  }
  return map[ext] || 'application/octet-stream'
}

async function startFrontendServer() {
  if (frontendServer && frontendOrigin) {
    return frontendOrigin
  }

  const distRoot = path.join(__dirname, 'dist')
  const indexPath = path.join(distRoot, 'index.html')

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Frontend not found: ${indexPath}`)
  }

  frontendServer = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url || '/', 'http://127.0.0.1').pathname,
      )

      const relativePath =
        pathname === '/'
          ? 'index.html'
          : pathname.replace(/^\/+/, '')

      // Keep the renderer's existing /vidora-sidebar-logo.png URL working even
      // when the PNG asset is not present in dist. Serve the packaged VIDORA ICO
      // at that URL; Chromium can render ICO files in an <img> element.
      const requestedLogo = pathname === '/vidora-sidebar-logo.png'

      if (requestedLogo) {
        const logoPNG = getRendererLogoPNG()

        if (!logoPNG) {
          response.writeHead(404)
          response.end('Logo not found')
          return
        }

        response.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
          'Content-Length': logoPNG.length,
        })
        response.end(logoPNG)
        return
      }

      const resolvedRoot = path.resolve(distRoot)
      let resolvedPath = path.resolve(resolvedRoot, relativePath)

      if (
        resolvedPath !== resolvedRoot &&
        !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
      ) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      if (
        !fs.existsSync(resolvedPath) ||
        fs.statSync(resolvedPath).isDirectory()
      ) {
        resolvedPath = indexPath
      }

      response.writeHead(200, {
        'Content-Type': getMimeType(resolvedPath),
        'Cache-Control':
          pathname === '/' || pathname.endsWith('/index.html')
            ? 'no-store'
            : 'public, max-age=31536000, immutable',
      })

      fs.createReadStream(resolvedPath).pipe(response)
    } catch (error) {
      console.error(
        '[VIDORA] frontend server error:',
        error,
      )

      response.writeHead(500)
      response.end('Internal Server Error')
    }
  })

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      frontendServer?.removeListener('listening', onListening)
      reject(error)
    }

    const onListening = () => {
      frontendServer?.removeListener('error', onError)
      resolve()
    }

    frontendServer.once('error', onError)
    frontendServer.once('listening', onListening)
    frontendServer.listen(5173, '127.0.0.1')
  })

  const address = frontendServer.address()

  if (!address || typeof address === 'string') {
    throw new Error('Could not determine frontend server address.')
  }

  frontendOrigin = `http://127.0.0.1:${address.port}`

  console.log(
    '[VIDORA] frontend server:',
    frontendOrigin,
  )

  return frontendOrigin
}

function stopFrontendServer() {
  if (!frontendServer) {
    return
  }

  try {
    frontendServer.close()
  } catch {
    // Already stopped.
  }

  frontendServer = null
  frontendOrigin = ''
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

    if (parsed.protocol === 'http:') {
      if (
        frontendOrigin &&
        parsed.origin === frontendOrigin
      ) {
        return true
      }

      if (
        isDev &&
        (
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1'
        )
      ) {
        return true
      }
    }

    if (parsed.protocol === 'file:') {
      const frontendURL = new URL(
        `file://${getFrontendPath().replace(/\\/g, '/')}`,
      )

      return (
        parsed.pathname === frontendURL.pathname
      )
    }

    return false
  } catch {
    return false
  }
}


/* =========================================================
   UPDATE IPC STATE
========================================================= */

function sendUpdateEvent(event, payload = {}) {
  if (!mainWindow) {
    return
  }

  if (mainWindow.webContents.isDestroyed()) {
    return
  }

  mainWindow.webContents.send('updater:event', {
    event,
    ...payload,
  })
}

/* =========================================================
   AUTO UPDATER
========================================================= */

function initializeAutoUpdater() {
  if (updaterInitialized || isDev) {
    return
  }

  updaterInitialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.disableDifferentialDownload = false
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('checking-for-update', () => {
    updateCheckInProgress = true
    sendUpdateEvent('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    updateCheckInProgress = true
    sendUpdateEvent('update-available', {
      version: info?.version || null,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInProgress = false
    updateDownloaded = false

    sendUpdateEvent('update-not-available', {
      version: info?.version || null,
      currentVersion: app.getVersion(),
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent('download-progress', {
      percent: Number.isFinite(progress?.percent)
        ? progress.percent
        : 0,
      bytesPerSecond: progress?.bytesPerSecond || 0,
      total: progress?.total || 0,
      transferred: progress?.transferred || 0,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateCheckInProgress = false
    updateDownloaded = true

    sendUpdateEvent('update-downloaded', {
      version: info?.version || null,
    })
  })

  autoUpdater.on('update-cancelled', (info) => {
    updateCheckInProgress = false
    updateDownloaded = false

    sendUpdateEvent('update-cancelled', {
      version: info?.version || null,
    })
  })

  autoUpdater.on('error', (error) => {
    updateCheckInProgress = false
    console.error('[VIDORA] updater error:', error)

    sendUpdateEvent('error', {
      message: error?.message || 'Update failed.',
    })
  })

  console.log('[VIDORA] auto updater initialized')
}

/* =========================================================
   UPDATE IPC HANDLERS
========================================================= */

ipcMain.handle('updater:check', async () => {
  if (isDev) {
    return {
      status: 'disabled-in-development',
      version: app.getVersion(),
    }
  }

  if (updateCheckInProgress) {
    return {
      status: 'checking',
      version: app.getVersion(),
    }
  }

  try {
    const result = await autoUpdater.checkForUpdates()

    if (!result) {
      return {
        status: 'unavailable',
        version: app.getVersion(),
      }
    }

    const available = Boolean(
      result.updateInfo &&
      result.updateInfo.version &&
      result.updateInfo.version !== app.getVersion(),
    )

    return {
      status: available ? 'available' : 'current',
      currentVersion: app.getVersion(),
      availableVersion: result?.updateInfo?.version || null,
    }
  } catch (error) {
    console.error('[VIDORA] update check failed:', error)

    return {
      status: 'error',
      message: error?.message || 'Could not check for updates.',
    }
  }
})

ipcMain.handle('updater:install', async () => {
  if (isDev) {
    return { status: 'disabled-in-development' }
  }

  if (!updateDownloaded) {
    return { status: 'not-downloaded' }
  }

  try {
    autoUpdater.quitAndInstall(true, true)
    return { status: 'installing' }
  } catch (error) {
    console.error('[VIDORA] update install failed:', error)

    return {
      status: 'error',
      message: error?.message || 'Could not install the update.',
    }
  }
})

ipcMain.handle('app:get-version', () => app.getVersion())

/* =========================================================
   WINDOW
========================================================= */

async function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()

    if (pendingAuthCallbackUrl) {
      const callback = pendingAuthCallbackUrl
      pendingAuthCallbackUrl = null
      deliverAuthCallback(callback)
    }

    return
  }

  const iconPath = getIconPath()

  console.log('[VIDORA] icon:', iconPath)

  if (!fs.existsSync(iconPath)) {
    console.warn('[VIDORA] icon not found:', iconPath)
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    title: APP_TITLE,
    icon: iconPath,
    backgroundColor: '#05070a',
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev,
    },
  })

  if (process.platform === 'win32' && fs.existsSync(iconPath)) {
    try {
      mainWindow.setIcon(iconPath)
    } catch (error) {
      console.warn('[VIDORA] setIcon failed:', error)
    }
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault()

    if (mainWindow) {
      mainWindow.setTitle(APP_TITLE)
    }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault()
      console.warn('[VIDORA] blocked navigation:', url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)

      const allowedAuthPopup =
        parsed.protocol === 'https:' &&
        (
          parsed.hostname === 'accounts.google.com' ||
          parsed.hostname.endsWith('.google.com') ||
          parsed.hostname.endsWith('.googleusercontent.com') ||
          parsed.hostname === 'firebaseapp.com' ||
          parsed.hostname.endsWith('.firebaseapp.com')
        )

      if (allowedAuthPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            icon: iconPath,
            title: 'VIDORA — Google Sign-In',
            autoHideMenuBar: true,
            backgroundColor: '#05070a',
            resizable: true,
            minimizable: true,
            maximizable: true,
            closable: true,
          },
        }
      }
    } catch {
      // Fall through to deny.
    }

    console.warn('[VIDORA] blocked new window:', url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault()
      console.warn('[VIDORA] blocked redirect:', url)
    }
  })

  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }

  let frontendURL

  try {
    frontendURL = await startFrontendServer()
  } catch (error) {
    console.error(
      '[VIDORA] frontend server failed:',
      error,
    )

    dialog.showErrorBox(
      APP_TITLE,
      error?.message ||
        'VIDORA could not start its local frontend.',
    )

    app.quit()
    return
  }

  console.log('[VIDORA] loading:', frontendURL)

  mainWindow.loadURL(`${frontendURL}/`)

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) {
      return
    }

    mainWindow.setTitle(APP_TITLE)

    if (process.platform === 'win32' && fs.existsSync(iconPath)) {
      try {
        mainWindow.setIcon(iconPath)
      } catch {
        // Ignore refresh errors.
      }
    }

    if (pendingAuthCallbackUrl) {
      const callback = pendingAuthCallbackUrl
      pendingAuthCallbackUrl = null
      setTimeout(() => {
        deliverAuthCallback(callback)
      }, 150)
    }

    console.log('[VIDORA] renderer loaded')
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        '[VIDORA] renderer failed:',
        errorCode,
        errorDescription,
        validatedURL,
      )
    },
  )

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/* =========================================================
   FOLDER PICKER
========================================================= */

ipcMain.handle('dialog:choose-folder', async () => {
  if (!mainWindow) {
    return null
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose VIDORA download folder',
      defaultPath: app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    })

    console.log('[VIDORA] folder picker result:', result)

    if (
      result.canceled ||
      !result.filePaths ||
      result.filePaths.length === 0
    ) {
      return null
    }

    return result.filePaths[0]
  } catch (error) {
    console.error('[VIDORA] folder picker error:', error)
    return null
  }
})

/* =========================================================
   SINGLE INSTANCE
========================================================= */

app.on('second-instance', (event, commandLine) => {
  const callbackUrl = getAuthCallbackFromArgv(commandLine)

  if (callbackUrl) {
    pendingAuthCallbackUrl = callbackUrl
  }

  if (!mainWindow) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()

  if (callbackUrl) {
    deliverAuthCallback(callbackUrl)
  }
})

/* =========================================================
   APP START
========================================================= */

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID)
  }

  registerAuthProtocol()

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (navigationEvent, url) => {
      if (
        isMainWindowContents(contents) &&
        !isAllowedNavigation(url)
      ) {
        navigationEvent.preventDefault()
      }
    })
  })

  startBackend()
  createWindow().catch((error) => {
    console.error('[VIDORA] window creation failed:', error)
    app.quit()
  })

  initializeAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

/* =========================================================
   SHUTDOWN
========================================================= */

app.on('before-quit', () => {
  stopBackend()
})

app.on('window-all-closed', () => {
  stopBackend()
  app.quit()
})