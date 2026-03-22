// ==================== 环境变量管理 ====================

/**
 * 环境变量验证和加载工具
 * 确保所有必需的环境变量都已正确配置
 */

interface EnvConfig {
  // 认证配置
  authUsername: string;
  authPassword: string;

  // API配置
  anthropicApiKey: string;
  anthropicApiVersion?: string;
  anthropicTimeout?: number;

  // 应用配置
  appName: string;
  appVersion: string;
  appDescription?: string;

  // 环境
  nodeEnv: string;

  // 服务配置
  port?: number;
  hostname?: string;

  // 数据存储
  dataDir: string;
  dataPersistence: boolean;

  // 功能开关
  enableAiFeatures: boolean;
  enableResumeParsing: boolean;

  // AI配置
  defaultClaudeModel: string;
  maxTokens: number;
  temperature: number;
  conversationHistoryLimit: number;

  // 限流
  rateLimitPerMinute: number;
  dailyConversationLimit: number;

  // 日志
  logLevel: "debug" | "info" | "warn" | "error";
  verboseLogging: boolean;

  // 性能
  enablePerformanceMonitoring: boolean;
  apiCacheTTL: number;

  // 开发
  debug: boolean;
  hotReload: boolean;
}

/**
 * 获取环境变量值，带默认值
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || "";
}

/**
 * 获取数字类型环境变量
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * 获取布尔类型环境变量
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value === "true" || value === "1";
}

/**
 * 加载并验证环境变量配置
 */
export function loadEnvConfig(): EnvConfig {
  const config: EnvConfig = {
    // 认证配置
    authUsername: getEnvVar("AUTH_USERNAME", "admin"),
    authPassword: getEnvVar("AUTH_PASSWORD", "admin123"),

    // API配置（必需）
    anthropicApiKey: getEnvVar("ANTHROPIC_API_KEY"),
    anthropicApiVersion: process.env.ANTHROPIC_API_VERSION,
    anthropicTimeout: getEnvNumber("ANTHROPIC_TIMEOUT", 60000),

    // 应用配置
    appName: getEnvVar("NEXT_PUBLIC_APP_NAME", "Nexus HR"),
    appVersion: getEnvVar("NEXT_PUBLIC_APP_VERSION", "2.1.0"),
    appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION,

    // 环境
    nodeEnv: getEnvVar("NODE_ENV", "development"),

    // 服务配置
    port: getEnvNumber("PORT", 3000),
    hostname: process.env.HOSTNAME,

    // 数据存储
    dataDir: getEnvVar("DATA_DIR", "./data"),
    dataPersistence: getEnvBoolean("DATA_PERSISTENCE", true),

    // 功能开关
    enableAiFeatures: getEnvBoolean("ENABLE_AI_FEATURES", true),
    enableResumeParsing: getEnvBoolean("ENABLE_RESUME_PARSING", true),

    // AI配置
    defaultClaudeModel: getEnvVar(
      "DEFAULT_CLAUDE_MODEL",
      "claude-3-5-sonnet-20241022"
    ),
    maxTokens: getEnvNumber("MAX_TOKENS", 4096),
    temperature: getEnvNumber("TEMPERATURE", 7) / 10,
    conversationHistoryLimit: getEnvNumber("CONVERSATION_HISTORY_LIMIT", 10),

    // 限流
    rateLimitPerMinute: getEnvNumber("RATE_LIMIT_PER_MINUTE", 60),
    dailyConversationLimit: getEnvNumber("DAILY_CONVERSATION_LIMIT", 100),

    // 日志
    logLevel: (getEnvVar("LOG_LEVEL", "info") as any) || "info",
    verboseLogging: getEnvBoolean("VERBOSE_LOGGING", false),

    // 性能
    enablePerformanceMonitoring: getEnvBoolean(
      "ENABLE_PERFORMANCE_MONITORING",
      true
    ),
    apiCacheTTL: getEnvNumber("API_CACHE_TTL", 300),

    // 开发
    debug: getEnvBoolean("DEBUG", false),
    hotReload: getEnvBoolean("HOT_RELOAD", true),
  };

  return config;
}

/**
 * 验证环境变量配置
 */
export function validateEnvConfig(config: EnvConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需的API Key
  if (!config.anthropicApiKey || config.anthropicApiKey === "your_api_key_here") {
    const hint = process.env.IS_ELECTRON
      ? "ANTHROPIC_API_KEY is not configured. Please set it in Settings."
      : "ANTHROPIC_API_KEY is not configured. Please set it in .env.local file.";
    errors.push(hint);
  }

  // 检查API Key格式（支持原生 Anthropic 和兼容 API 如 BigModel）
  if (
    config.anthropicApiKey &&
    config.anthropicApiKey.length < 10
  ) {
    warnings.push(
      "ANTHROPIC_API_KEY 长度过短，请确认密钥是否完整"
    );
  }

  // 检查数据目录
  if (config.dataPersistence) {
    // 数据目录将在运行时创建
  }

  // 检查配置值的合理性
  if (config.maxTokens < 1 || config.maxTokens > 200000) {
    warnings.push("MAX_TOKENS should be between 1 and 200000");
  }

  if (config.temperature < 0 || config.temperature > 1) {
    warnings.push("TEMPERATURE should be between 0 and 1");
  }

  if (config.rateLimitPerMinute < 1 || config.rateLimitPerMinute > 1000) {
    warnings.push("RATE_LIMIT_PER_MINUTE should be between 1 and 1000");
  }

  // 开发环境警告
  if (config.nodeEnv === "production" && config.debug) {
    warnings.push("DEBUG mode should not be enabled in production");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 打印环境配置状态
 */
export function printEnvStatus(config: EnvConfig): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔧 Nexus HR - 环境配置状态");
  console.log("=".repeat(60));

  console.log(`\n📦 应用信息:`);
  console.log(`   名称: ${config.appName}`);
  console.log(`   版本: ${config.appVersion}`);
  console.log(`   环境: ${config.nodeEnv}`);

  console.log(`\n🤖 AI配置:`);
  console.log(`   API Key: ${config.anthropicApiKey ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`   模型: ${config.defaultClaudeModel}`);
  console.log(`   Max Tokens: ${config.maxTokens}`);
  console.log(`   Temperature: ${config.temperature}`);

  console.log(`\n⚙️ 功能开关:`);
  console.log(`   AI功能: ${config.enableAiFeatures ? "✅ 启用" : "❌ 禁用"}`);
  console.log(`   简历解析: ${config.enableResumeParsing ? "✅ 启用" : "❌ 禁用"}`);
  console.log(`   性能监控: ${config.enablePerformanceMonitoring ? "✅ 启用" : "❌ 禁用"}`);

  console.log(`\n📊 服务配置:`);
  console.log(`   端口: ${config.port}`);
  console.log(`   数据目录: ${config.dataDir}`);
  console.log(`   日志级别: ${config.logLevel}`);

  console.log("\n" + "=".repeat(60) + "\n");
}

/**
 * 获取公共环境变量（可在客户端使用）
 */
export function getPublicEnvConfig() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Nexus HR",
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "2.1.0",
    appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
    gaId: process.env.NEXT_PUBLIC_GA_ID,
    publicDsn: process.env.NEXT_PUBLIC_PUBLIC_DSN,
    isElectron: process.env.IS_ELECTRON === "true",
  };
}

export function isElectronMode(): boolean {
  return process.env.IS_ELECTRON === "true";
}

// 导出单例配置实例
let envConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    envConfig = loadEnvConfig();

    // 验证配置
    const validation = validateEnvConfig(envConfig);

    // 打印警告
    if (validation.warnings.length > 0) {
      console.warn("\n⚠️ 配置警告:");
      validation.warnings.forEach((warning) => console.warn(`   - ${warning}`));
    }

    // 打印错误
    if (validation.errors.length > 0) {
      console.error("\n❌ 配置错误:");
      validation.errors.forEach((error) => console.error(`   - ${error}`));
      throw new Error("Environment configuration validation failed");
    }

    // 打印状态
    printEnvStatus(envConfig);
  }

  return envConfig;
}

/**
 * 重置环境配置缓存（主要用于测试）
 */
export function resetEnvConfig(): void {
  envConfig = null;
}
