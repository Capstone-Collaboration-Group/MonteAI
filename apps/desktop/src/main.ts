import { app, BrowserWindow, protocol } from 'electron';
import path from 'node:path';
import { registerBackupHandlers } from './handlers/backup';
import { DESKTOP_PARTITION, registerAppProtocol } from './handlers/appProtocol';

app.setName('MonteSkolar');

// Honor Chromium's explicit profile override (also useful for isolated smoke tests).
const userDataDir = app.commandLine.getSwitchValue('user-data-dir');
if (userDataDir) app.setPath('userData', path.resolve(userDataDir));

// Unlike file://, this is a secure, allowlisted origin with persistent browser
// storage independent of the install directory. Never disable webSecurity.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'monteskolar',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'MonteSkolar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: DESKTOP_PARTITION,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL('monteskolar://app/index.html');
  }

  if (!app.isPackaged) mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs. 
app.on('ready', () => { 
  if (process.platform === 'win32') app.setAppUserModelId('edu.cdm.monteskolar');
  if (app.isPackaged) {
    registerAppProtocol(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`));
  }
  registerBackupHandlers();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
