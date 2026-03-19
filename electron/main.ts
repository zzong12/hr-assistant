import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
} from "electron";
import { ChildProcess, fork } from "child_process";
import path from "path";
import fs from "fs";
import {
  configExists,
  loadConfig,
  saveConfig,
  configToEnv,
  getDataDir,
  type AppConfig,
} from "./config-manager";
import { createTray, destroyTray } from "./tray";

let mainWindow: BrowserWindow | null = null;
let setupWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort = 3000;

const isDev = !app.isPackaged;

function getServerPath(): string {
  if (isDev) {
    return path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  }
  return path.join(process.resourcesPath, "standalone", "server.js");
}

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function ensureDataDir(): void {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const resumeDir = path.join(dataDir, "resumes");
  if (!fs.existsSync(resumeDir)) {
    fs.mkdirSync(resumeDir, { recursive: true });
  }
}

function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = loadConfig();
    if (!config) {
      reject(new Error("No configuration found"));
      return;
    }

    ensureDataDir();

    const envVars = configToEnv(config);
    serverPort = config.PORT || 3000;

    if (isDev) {
      const serverPath = getServerPath();
      serverProcess = fork(serverPath, ["dev"], {
        env: {
          ...process.env,
          ...envVars,
          NODE_ENV: "development",
          PORT: String(serverPort),
        },
        cwd: process.cwd(),
        stdio: "pipe",
      });
    } else {
      const serverPath = getServerPath();
      serverProcess = fork(serverPath, [], {
        env: {
          ...process.env,
          ...envVars,
          NODE_ENV: "production",
          PORT: String(serverPort),
          HOSTNAME: "localhost",
        },
        stdio: "pipe",
      });
    }

    let started = false;

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[Next.js]", output);
      if (!started && output.includes("Ready")) {
        started = true;
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Next.js Error]", data.toString());
    });

    serverProcess.on("error", (err) => {
      console.error("[Next.js Process Error]", err);
      if (!started) reject(err);
    });

    serverProcess.on("exit", (code) => {
      console.log(`[Next.js] Process exited with code ${code}`);
      serverProcess = null;
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve();
      }
    }, 15000);
  });
}

function stopNextServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

async function restartNextServer(): Promise<void> {
  stopNextServer();
  await new Promise((r) => setTimeout(r, 1000));
  await startNextServer();
}

function createMainWindow(): void {
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Nexus HR",
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 16, y: 14 },
        }
      : {}),
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  createTray(mainWindow);
}

function getSetupHtmlPath(): string {
  if (isDev) {
    return path.join(process.cwd(), "electron", "setup.html");
  }
  // In packaged app, setup.html is at app.asar/electron/setup.html
  // __dirname is app.asar/dist-electron, so go up one level
  return path.join(__dirname, "..", "electron", "setup.html");
}

function createSetupWindow(): void {
  setupWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    title: "Nexus HR - 初始配置",
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  setupWindow.loadFile(getSetupHtmlPath());

  setupWindow.once("ready-to-show", () => {
    setupWindow?.show();
  });

  setupWindow.on("closed", () => {
    setupWindow = null;
    if (!configExists()) {
      app.quit();
    }
  });
}

function buildAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Nexus HR",
      submenu: [
        { role: "about", label: "关于 Nexus HR" },
        { type: "separator" },
        {
          label: "偏好设置...",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(`http://localhost:${serverPort}/settings`);
              mainWindow.show();
            }
          },
        },
        { type: "separator" },
        { role: "hide", label: "隐藏" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "显示全部" },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "刷新" },
        { role: "forceReload", label: "强制刷新" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "切换全屏" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        { type: "separator" },
        { role: "front", label: "全部置于顶层" },
      ],
    },
  ];

  if (isDev) {
    (template[2].submenu as Electron.MenuItemConstructorOptions[]).push(
      { type: "separator" },
      { role: "toggleDevTools", label: "开发者工具" }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ==================== IPC Handlers ====================

function registerIpcHandlers(): void {
  ipcMain.handle("get-config", () => {
    return loadConfig();
  });

  ipcMain.handle("save-config", async (_event, config: AppConfig) => {
    try {
      saveConfig(config);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("restart-server", async () => {
    try {
      await restartNextServer();
      if (mainWindow) {
        mainWindow.loadURL(`http://localhost:${serverPort}`);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("get-app-info", () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      dataPath: getDataDir(),
      isPackaged: app.isPackaged,
      platform: process.platform,
    };
  });

  ipcMain.handle("setup-complete", async (_event, config: AppConfig) => {
    try {
      saveConfig(config);
      setupWindow?.close();

      await startNextServer();
      createMainWindow();
      return { success: true };
    } catch (err) {
      dialog.showErrorBox("启动失败", `无法启动服务: ${err}`);
      return { success: false, error: String(err) };
    }
  });
}

// ==================== App Lifecycle ====================

app.whenReady().then(async () => {
  registerIpcHandlers();
  buildAppMenu();

  if (configExists()) {
    try {
      await startNextServer();
      createMainWindow();
    } catch (err) {
      dialog.showErrorBox(
        "启动失败",
        `无法启动 Next.js 服务。请检查配置。\n\n${err}`
      );
      createSetupWindow();
    }
  } else {
    createSetupWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null && configExists()) {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  stopNextServer();
  destroyTray();
});
