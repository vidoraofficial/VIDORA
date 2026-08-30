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
const { autoUpdater } = require('electron-updater')

const APP_ID = 'com.vidora.desktop'
const APP_TITLE = 'VIDORA'
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
let backendStartingPromise = null

const isDev = !app.isPackaged

let updaterInitialized = false
let updateCheckInProgress = false
let updateDownloaded = false
let verifiedUpdateVersion = null

/* =========================================================
   VERSION COMPARISON
========================================================= */
function normalizeVersion(value) {
  const match = String(value || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/)

  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : null
}

function compareVersions(a, b) {
  const av = normalizeVersion(a)
  const bv = normalizeVersion(b)
  if (!av || !bv) return null

  for (let i = 0; i < 3; i += 1) {
    if (av[i] > bv[i]) return 1
    if (av[i] < bv[i]) return -1
  }
  return 0
}

function isNewerVersion(candidate, current) {
  return compareVersions(candidate, current) === 1
}

/* =========================================================
   PATHS
========================================================= */
function getFrontendPath() {
  return path.join(__dirname, 'dist', 'index.html')
}

function getBackendCandidates() {
  if (isDev) {
    return [
      path.join(__dirname, 'backend', 'VideoDownloaderBackend.exe'),
      path.join(__dirname, '..', 'backend', 'VideoDownloaderBackend.exe'),
    ]
  }

  return [
    path.join(process.resourcesPath, 'backend', 'VideoDownloaderBackend.exe'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'VideoDownloaderBackend.exe'),
  ]
}

function getBackendPath() {
  const candidates = getBackendCandidates()
  const existing = candidates.find((candidate) => fs.existsSync(candidate))
  return existing || candidates[0]
}

function getIconCandidates() {
  return [
    path.join(__dirname, 'build', 'vidora.ico'),
    path.join(process.resourcesPath, 'build', 'vidora.ico'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'vidora.ico'),
  ]
}

function getIconPath() {
  const candidates = getIconCandidates()
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
}

/* =========================================================
   BUNDLED RUNTIMES
========================================================= */
function getRuntimeCandidates() {
  if (isDev) {
    return [
      path.join(__dirname, 'runtime'),
      path.join(__dirname, '..', 'runtime'),
    ]
  }

  return [
    path.join(process.resourcesPath, 'runtime'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'runtime'),
  ]
}

function getRuntimeRoot() {
  const candidates = getRuntimeCandidates()
  const working = candidates.find((root) => fs.existsSync(root))
  return working || candidates[0]
}

function getBundledRuntimePaths() {
  const root = getRuntimeRoot()
  return {
    root,
    nodeDir: path.join(root, 'node'),
    ffmpegDir: path.join(root, 'ffmpeg', 'bin'),
    nodeExe: path.join(root, 'node', 'node.exe'),
    ffmpegExe: path.join(root, 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ffprobeExe: path.join(root, 'ffmpeg', 'bin', 'ffprobe.exe'),
  }
}

/* =========================================================
   BACKEND LOGGING
========================================================= */
function getLogDirectory() {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeBackendLog(text) {
  try {
    const file = path.join(getLogDirectory(), 'backend.log')
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${text}\r\n`, 'utf8')
  } catch {
    // Logging must never prevent VIDORA from starting.
  }
}

/* =========================================================
   BACKEND
========================================================= */
function startBackend() {
  if (backendProcess && !backendProcess.killed) {
    return true
  }

  const backendPath = getBackendPath()
  const runtime = getBundledRuntimePaths()

  if (!fs.existsSync(backendPath)) {
    const message = `[VIDORA] backend not found: ${backendPath}`
    console.error(message)
    writeBackendLog(message)
    writeBackendLog(`BACKEND_CANDIDATES ${JSON.stringify(getBackendCandidates())}`)
    return false
  }

  const runtimeDirs = [
    runtime.nodeDir,
    runtime.ffmpegDir,
  ].filter((directory) => fs.existsSync(directory))

  const env = {
    ...process.env,
    VIDORA_NODE_PATH: runtime.nodeExe,
    VIDORA_FFMPEG_PATH: runtime.ffmpegExe,
    VIDORA_FFPROBE_PATH: runtime.ffprobeExe,
    VIDORA_BACKEND_EXE: backendPath,
    PATH: [
      ...runtimeDirs,
      process.env.PATH || '',
    ].filter(Boolean).join(path.delimiter),
  }

  const startupInfo = {
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    backendPath,
    backendExists: fs.existsSync(backendPath),
    runtimeRoot: runtime.root,
    node: fs.existsSync(runtime.nodeExe),
    ffmpeg: fs.existsSync(runtime.ffmpegExe),
    ffprobe: fs.existsSync(runtime.ffprobeExe),
    cwd: path.dirname(backendPath),
  }

  console.log('[VIDORA] starting backend:', startupInfo)
  writeBackendLog(`START ${JSON.stringify(startupInfo)}`)

  try {
    backendProcess = spawn(backendPath, [], {
      cwd: path.dirname(backendPath),
      env,
      windowsHide: true,
      detached: false,
      shell: false,
      windowsVerbatimArguments: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    console.error('[VIDORA] backend spawn threw:', error)
    writeBackendLog(`SPAWN_THROW ${error?.stack || error}`)
    backendProcess = null
    return false
  }

  backendProcess.stdout?.setEncoding('utf8')
  backendProcess.stderr?.setEncoding('utf8')

  backendProcess.stdout?.on('data', (chunk) => {
    const text = String(chunk)
    process.stdout.write(`[VIDORA][backend] ${text}`)
    writeBackendLog(`STDOUT ${text.trimEnd()}`)
  })

  backendProcess.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    process.stderr.write(`[VIDORA][backend] ${text}`)
    writeBackendLog(`STDERR ${text.trimEnd()}`)
  })

  backendProcess.on('error', (error) => {
    console.error('[VIDORA] backend error:', error)
    writeBackendLog(`ERROR ${error?.stack || error}`)
    backendProcess = null
  })

  backendProcess.on('exit', (code, signal) => {
    console.log('[VIDORA] backend exited:', { code, signal })
    writeBackendLog(`EXIT code=${code} signal=${signal}`)
    backendProcess = null
  })

  writeBackendLog(`SPAWNED pid=${backendProcess.pid}`)
  return true
}

function stopBackend() {
  if (!backendProcess) return

  try {
    backendProcess.kill()
  } catch {
    // Already stopped.
  }

  backendProcess = null
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const request = http.get(
      'http://127.0.0.1:8000/health',
      {
        timeout: 1500,
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'close',
        },
      },
      (response) => {
        const ok = response.statusCode === 200
        response.resume()
        resolve(ok)
      },
    )

    request.on('error', () => resolve(false))
    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
  })
}

async function waitForBackend(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await checkBackendHealth()) {
      console.log('[VIDORA] backend is ready')
      writeBackendLog('HEALTHCHECK OK')
      return true
    }

    // Do not stop waiting merely because the child briefly disappeared;
    // ensureBackend() can retry startup below.
    await new Promise((resolve) => setTimeout(resolve, 400))
  }

  writeBackendLog('HEALTHCHECK TIMEOUT')
  return false
}

async function ensureBackend() {
  if (await checkBackendHealth()) {
    writeBackendLog('ALREADY HEALTHY')
    return true
  }

  if (backendStartingPromise) {
    return backendStartingPromise
  }

  backendStartingPromise = (async () => {
    // Try startup once, then one clean retry. This handles occasional
    // Windows process-spawn timing issues without requiring manual launch.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      writeBackendLog(`START_ATTEMPT ${attempt}/2`)

      const started = startBackend()
      if (!started) {
        if (attempt === 2) return false
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }

      if (await waitForBackend(45000)) {
        return true
      }

      writeBackendLog(`START_ATTEMPT_FAILED ${attempt}/2`)
      stopBackend()

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return false
  })().finally(() => {
    backendStartingPromise = null
  })

  return backendStartingPromise
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
    '.json': 'application/json',
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
  if (frontendServer && frontendOrigin) return frontendOrigin

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

      const relativePath = pathname === '/'
        ? 'index.html'
        : pathname.replace(/^\/+/, '')

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
        'Cache-Control': pathname === '/' || pathname.endsWith('/index.html')
          ? 'no-store'
          : 'public, max-age=31536000, immutable',
      })

      fs.createReadStream(resolvedPath).pipe(response)
    } catch (error) {
      console.error('[VIDORA] frontend server error:', error)
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
  console.log('[VIDORA] frontend server:', frontendOrigin)
  return frontendOrigin
}

function stopFrontendServer() {
  if (!frontendServer) return
  try { frontendServer.close() } catch {}
  frontendServer = null
  frontendOrigin = ''
}

/* =========================================================
   SECURITY
========================================================= */
function isMainWindowContents(contents) {
  return Boolean(mainWindow && contents === mainWindow.webContents)
}

function isAllowedNavigation(url) {
  if (!url) return false

  try {
    const parsed = new URL(url)

    if (parsed.protocol === 'http:') {
      if (frontendOrigin && parsed.origin === frontendOrigin) return true
      if (isDev && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) return true
    }

    if (parsed.protocol === 'file:') {
      const frontendURL = new URL(`file://${getFrontendPath().replace(/\\/g, '/')}`)
      return parsed.pathname === frontendURL.pathname
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
  if (!mainWindow || mainWindow.webContents.isDestroyed()) return
  mainWindow.webContents.send('updater:event', { event, ...payload })
}

/* =========================================================
   AUTO UPDATER
========================================================= */
function initializeAutoUpdater() {
  if (updaterInitialized || isDev) return
  updaterInitialized = true

  autoUpdater.autoDownload = false
  autoUpdater.allowPrerelease = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.disableDifferentialDownload = false
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('checking-for-update', () => {
    updateCheckInProgress = true
    sendUpdateEvent('checking-for-update')
  })

  autoUpdater.on('update-available', (info) => {
    const availableVersion = info?.version || ''
    const currentVersion = app.getVersion()

    if (!isNewerVersion(availableVersion, currentVersion)) {
      updateCheckInProgress = false
      verifiedUpdateVersion = null
      sendUpdateEvent('update-not-available', { version: currentVersion, currentVersion })
      return
    }

    verifiedUpdateVersion = availableVersion
    updateCheckInProgress = true
    sendUpdateEvent('update-available', { version: availableVersion, currentVersion })
  })

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInProgress = false
    updateDownloaded = false
    verifiedUpdateVersion = null
    sendUpdateEvent('update-not-available', {
      version: info?.version || app.getVersion(),
      currentVersion: app.getVersion(),
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent('download-progress', {
      percent: Number.isFinite(progress?.percent) ? progress.percent : 0,
      bytesPerSecond: progress?.bytesPerSecond || 0,
      total: progress?.total || 0,
      transferred: progress?.transferred || 0,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateCheckInProgress = false
    updateDownloaded = true
    sendUpdateEvent('update-downloaded', {
      version: info?.version || verifiedUpdateVersion || null,
    })
  })

  autoUpdater.on('update-cancelled', (info) => {
    updateCheckInProgress = false
    updateDownloaded = false
    verifiedUpdateVersion = null
    sendUpdateEvent('update-cancelled', { version: info?.version || null })
  })

  autoUpdater.on('error', (error) => {
    updateCheckInProgress = false
    updateDownloaded = false
    verifiedUpdateVersion = null
    console.error('[VIDORA] updater error:', error)
    sendUpdateEvent('error', { message: error?.message || 'Update failed.' })
  })
}

/* =========================================================
   UPDATE IPC HANDLERS
========================================================= */
ipcMain.handle('updater:check', async () => {
  if (isDev) return { status: 'disabled-in-development', version: app.getVersion() }
  if (updateCheckInProgress) return { status: 'checking', version: app.getVersion() }

  try {
    verifiedUpdateVersion = null
    const result = await autoUpdater.checkForUpdates()

    if (!result) {
      updateCheckInProgress = false
      return { status: 'unavailable', version: app.getVersion() }
    }

    const currentVersion = app.getVersion()
    const availableVersion = result?.updateInfo?.version || null

    if (!availableVersion || !isNewerVersion(availableVersion, currentVersion)) {
      updateCheckInProgress = false
      verifiedUpdateVersion = null
      return { status: 'current', currentVersion, availableVersion }
    }

    verifiedUpdateVersion = availableVersion
    await autoUpdater.downloadUpdate()

    return { status: 'available', currentVersion, availableVersion }
  } catch (error) {
    updateCheckInProgress = false
    verifiedUpdateVersion = null
    console.error('[VIDORA] update check failed:', error)
    return { status: 'error', message: error?.message || 'Could not check for updates.' }
  }
})

ipcMain.handle('updater:install', async () => {
  if (isDev) return { status: 'disabled-in-development' }
  if (!updateDownloaded) return { status: 'not-downloaded' }

  try {
    autoUpdater.quitAndInstall(true, true)
    return { status: 'installing' }
  } catch (error) {
    console.error('[VIDORA] update install failed:', error)
    return { status: 'error', message: error?.message || 'Could not install the update.' }
  }
})

ipcMain.handle('app:get-version', () => app.getVersion())

/* =========================================================
   WINDOW
========================================================= */
async function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  const iconPath = getIconPath()
  const hasIcon = fs.existsSync(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1050,
    minHeight: 700,
    title: APP_TITLE,
    icon: hasIcon ? iconPath : undefined,
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

  if (process.platform === 'win32' && hasIcon) {
    try { mainWindow.setIcon(iconPath) } catch (error) { console.warn('[VIDORA] setIcon failed:', error) }
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow?.setTitle(APP_TITLE)
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault()
      console.warn('[VIDORA] blocked navigation:', url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('[VIDORA] blocked new window:', url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault()
  })

  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => mainWindow?.webContents.closeDevTools())
  }

  const frontendURL = await startFrontendServer()
  await mainWindow.loadURL(`${frontendURL}/`)

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.setTitle(APP_TITLE)
    console.log('[VIDORA] renderer loaded')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[VIDORA] renderer failed:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

/* =========================================================
   FOLDER PICKER
========================================================= */ipcMain.handle('dialog:choose-folder', async () => {
  if (!mainWindow) return null

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose VIDORA download folder',
      defaultPath: app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || !result.filePaths?.length) return null
    return result.filePaths[0]
  } catch (error) {
    console.error('[VIDORA] folder picker error:', error)
    return null
  }
})

/* =========================================================
   SINGLE INSTANCE
========================================================= */
app.on('second-instance', () => {
  if (!mainWindow) {
    createWindow().catch((error) => console.error('[VIDORA] window creation failed:', error))
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

/* =========================================================
   APP START
========================================================= */
app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (navigationEvent, url) => {
      if (isMainWindowContents(contents) && !isAllowedNavigation(url)) {
        navigationEvent.preventDefault()
      }
    })
  })

  // Critical: ensure the bundled backend is running before any renderer loads.
  const backendReady = await ensureBackend()

  if (!backendReady) {
    const logPath = path.join(getLogDirectory(), 'backend.log')
    dialog.showErrorBox(
      APP_TITLE,
      `VIDORA could not start its local download engine.\n\nBackend diagnostics were written to:\n${logPath}`,
    )
    app.quit()
    return
  }

  try {
    await createWindow()
  } catch (error) {
    console.error('[VIDORA] window creation failed:', error)
    dialog.showErrorBox(APP_TITLE, error?.message || 'VIDORA could not start.')
    app.quit()
    return
  }

  initializeAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => console.error('[VIDORA] window creation failed:', error))
    }
  })
})

/* =========================================================
   SHUTDOWN
========================================================= */
app.on('before-quit', () => {
  stopFrontendServer()
  stopBackend()
})

app.on('window-all-closed', () => {
  stopFrontendServer()
  stopBackend()
  app.quit()
})
