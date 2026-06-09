const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let petWindow = null;
let tray = null;
let petVisualW = 256;  // updated by renderer
let petVisualH = 256;

function createPetWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().bounds;

  petWindow = new BrowserWindow({
    width: 520,
    height: 520,
    x: screenWidth - 520 + Math.round((520 - petVisualW) / 2),
    y: screenHeight - 520 + Math.round((520 - petVisualH) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Make window click-through on transparent areas (Windows)
  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

function createTray() {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Pet',
      click: () => {
        if (petWindow) {
          petWindow.isVisible() ? petWindow.hide() : petWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Desktop Pet');
  tray.setContextMenu(contextMenu);
}

// IPC handlers
ipcMain.on('set-pet-size', (event, { w, h }) => {
  petVisualW = w;
  petVisualH = h;
});

ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const d = screen.getPrimaryDisplay().bounds;
  const [x, y] = petWindow.getPosition();
  const [w, h] = petWindow.getSize();
  // Transparent padding around character visual
  const padX = Math.round((w - petVisualW) / 2);
  const padY = Math.round((h - petVisualH) / 2);
  // Clamp — silently stop at edge, no error
  const nx = Math.round(Math.max(-padX, Math.min(d.width - w + padX, x + deltaX)));
  const ny = Math.round(Math.max(-padY, Math.min(d.height - h + padY, y + deltaY)));
  if (nx !== x || ny !== y) {
    petWindow.setPosition(nx, ny);
  }
});

app.whenReady().then(() => {
  createPetWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('activate', () => {
  if (petWindow === null) {
    createPetWindow();
  }
});

app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
