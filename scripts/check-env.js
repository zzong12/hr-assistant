#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

console.log('\n' + '='.repeat(60));
log(colors.cyan, '🔍 HR数字助手 - 环境检查工具');
log(colors.blue, '='.repeat(60));

// Check .env.local
log(colors.blue, '\n📋 检查环境变量文件...\n');

const envLocalPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envLocalPath)) {
  log(colors.red, '❌ 未找到 .env.local 文件');
  log(colors.yellow, '\n💡 请执行以下步骤：');
  log(colors.white, '   1. 复制 .env.local.example 为 .env.local');
  log(colors.white, '   2. 编辑 .env.local，配置您的 ANTHROPIC_API_KEY');
  log(colors.cyan, '\n快速配置命令：');
  log(colors.white, '   cp .env.local.example .env.local');
  log(colors.white, '   nano .env.local\n');
  process.exit(1);
}

log(colors.green, '✅ .env.local 文件存在');

// Check environment variables
log(colors.blue, '\n🔑 检查必需的环境变量...\n');

const envFile = fs.readFileSync(envLocalPath, 'utf-8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('='))
    .filter(([key]) => key)
);

const requiredVars = ['ANTHROPIC_API_KEY'];
let hasErrors = false;

log(colors.cyan, '必需变量：');
requiredVars.forEach(varName => {
  const value = envVars[varName];
  if (!value || value === 'your_api_key_here') {
    log(colors.red, `   ❌ ${varName} - 未配置或使用默认值`);
    hasErrors = true;
  } else {
    const maskedValue = varName.includes('KEY')
      ? `${value.substring(0, 7)}...${value.substring(value.length - 4)}`
      : value;
    log(colors.green, `   ✅ ${varName} = ${maskedValue}`);
  }
});

// Show summary
log(colors.blue, '\n' + '='.repeat(60));
log(colors.cyan, '📊 配置摘要');
log(colors.blue, '='.repeat(60) + '\n');

try {
  const packageJson = require('../package.json');
  log(colors.white, `项目名称: ${packageJson.name}`);
  log(colors.white, `项目版本: ${packageJson.version}`);
} catch (e) {
  log(colors.yellow, '项目信息: 无法读取');
}

log(colors.white, `运行环境: ${process.env.NODE_ENV || 'development'}`);
log(colors.white, `Node版本: ${process.version}`);

log(colors.blue, '\n' + '='.repeat(60) + '\n');

if (hasErrors) {
  log(colors.red, '❌ 环境检查失败！请配置缺失的环境变量。\n');
  log(colors.yellow, '配置步骤：');
  log(colors.white, '   1. 编辑 .env.local 文件');
  log(colors.white, '   2. 设置 ANTHROPIC_API_KEY=sk-ant-xxxxx');
  log(colors.white, '   3. 重新运行此脚本\n');
  process.exit(1);
} else {
  log(colors.green, '✅ 环境检查通过！可以启动服务了。\n');
  log(colors.cyan, '启动命令：');
  log(colors.white, '   npm run dev\n');
  process.exit(0);
}
