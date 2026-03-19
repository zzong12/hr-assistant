import { app } from "electron";
import fs from "fs";
import path from "path";

export interface AppConfig {
  // Required
  ANTHROPIC_API_KEY: string;

  // Optional with defaults
  ANTHROPIC_BASE_URL?: string;
  DEFAULT_CLAUDE_MODEL?: string;
  MAX_TOKENS?: number;
  TEMPERATURE?: number;
  AUTH_USERNAME?: string;
  AUTH_PASSWORD?: string;
  PORT?: number;

  // Feishu (optional)
  FEISHU_APP_ID?: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_WEBHOOK_URL?: string;
}

const CONFIG_FILENAME = "config.json";

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME);
}

export function getDataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

export function configExists(): boolean {
  return fs.existsSync(getConfigPath());
}

export function loadConfig(): AppConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function configToEnv(config: AppConfig): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.ANTHROPIC_API_KEY) env.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY;
  if (config.ANTHROPIC_BASE_URL) env.ANTHROPIC_BASE_URL = config.ANTHROPIC_BASE_URL;
  if (config.DEFAULT_CLAUDE_MODEL) env.DEFAULT_CLAUDE_MODEL = config.DEFAULT_CLAUDE_MODEL;
  if (config.MAX_TOKENS != null) env.MAX_TOKENS = String(config.MAX_TOKENS);
  if (config.TEMPERATURE != null) env.TEMPERATURE = String(Math.round(config.TEMPERATURE * 10));
  if (config.AUTH_USERNAME) env.AUTH_USERNAME = config.AUTH_USERNAME;
  if (config.AUTH_PASSWORD) env.AUTH_PASSWORD = config.AUTH_PASSWORD;
  if (config.PORT != null) env.PORT = String(config.PORT);
  if (config.FEISHU_APP_ID) env.FEISHU_APP_ID = config.FEISHU_APP_ID;
  if (config.FEISHU_APP_SECRET) env.FEISHU_APP_SECRET = config.FEISHU_APP_SECRET;
  if (config.FEISHU_WEBHOOK_URL) env.FEISHU_WEBHOOK_URL = config.FEISHU_WEBHOOK_URL;

  env.DATA_DIR = getDataDir();
  env.IS_ELECTRON = "true";

  return env;
}
