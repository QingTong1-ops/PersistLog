# 恒序 persistLog · Backend

Phase 1 后端：计划导入、路线与任务、每日执行、执行看板、企业微信推送。

产品/技术文档在 `docs/`：

- `docs/01-产品与功能.md`
- `docs/02-技术设计.md`
- `docs/03-后端开发计划.md`
- `docs/04-当前进度总结.md`
- `docs/05-前端对接说明.md`
- `docs/06-后续开发计划.md`
- `docs/schema.sql`
- `docs/openapi.json`

## 本地启动

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# 编辑 .env，填入本地 MySQL 密码和随机密钥
.\.venv\Scripts\python.exe scripts\init_db.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

接口文档：<http://127.0.0.1:8000/docs>

## 本地 Redis / Celery

本机使用便携版 Redis 5.0.14.1，安装在 `.redis/redis/`（已 gitignore，不提交）：

```powershell
# 启动 Redis（前台，Ctrl+C 停止）
.\scripts\start_redis.ps1

# 另开终端启动 worker
.\scripts\start_worker.ps1

# 另开终端启动 beat
.\scripts\start_beat.ps1
```

验证：`.\.redis\redis\redis-cli.exe ping` 应返回 `PONG`。

已创建 Windows 计划任务 **`persistLog-Redis`**：当前用户登录 Windows 后自动启动 Redis（无需管理员权限）。在新机器/新仓库上重建任务：

```powershell
.\scripts\install_redis_autostart.ps1
```

日常管理：

```powershell
# 查看状态
Get-ScheduledTask -TaskName persistLog-Redis
Get-ScheduledTaskInfo -TaskName persistLog-Redis

# 手动触发
Start-ScheduledTask -TaskName persistLog-Redis

# 删除自启
Unregister-ScheduledTask -TaskName persistLog-Redis -Confirm:$false
```

> 这是“用户登录时自启”，不是登录前的系统服务；注销当前用户后 Redis 可能随之停止。若要开机即启动（登录前/跨会话持续运行），需要管理员权限安装 Windows 服务；当前账户非管理员，未做系统级安装。

Redis 仅用于本地开发：只绑定 `127.0.0.1`、无密码，不要暴露到公网或写入生产配置。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

测试使用 `persistlog_test`，每个 API 测试前后清表；上传文件写入 `storage_test/`；测试强制 AI 使用 Stub、通知使用 Logging Provider，不访问外网。当前为 **111 passed**。

## 数据库

- 主库：`persistlog`
- 测试库：`persistlog_test`
- 字符集：`utf8mb4 / utf8mb4_0900_ai_ci`
- DDL 以 `docs/schema.sql` 为准；`alembic` baseline 从该文件生成。
- 审计表、通知渠道/模板/偏好/Outbox、每日计划、任务实例等 Phase 1 表均包含在 baseline 中。

### 迁移

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

`alembic downgrade base` 仅用于本地/临时库演练，会删除 Phase 1 业务表。

### 备份与恢复

```powershell
$mysqldump = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
& $mysqldump --host=127.0.0.1 --port=3306 --protocol=TCP `
  --user=root --single-transaction --routines --triggers persistlog > backup.sql

$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql --host=127.0.0.1 --port=3306 --protocol=TCP --user=root persistlog < backup.sql
```

恢复前确认目标库为空或已备份；生产环境不要使用 `.env` 中的本地密码，密钥应通过 Secrets Manager 注入。

### 种子数据

- `scripts/init_db.py` 会应用 `docs/schema.sql`，包含 5 条默认通知模板。
- 用户注册时创建默认档案：容量 0.8、日界线 04:00、时区 `Asia/Shanghai`。
- 未配置通知渠道时，今日页和看板仍可用。

## 配置要点

- `AI_PROVIDER=stub`：本地导入不访问外部模型；接真实模型时设为 `deepseek` 或 `openai_compatible`。
- `AI_MODEL` / `AI_BASE_URL` / `AI_API_KEY`：OpenAI-compatible 配置；当前本地使用 `deepseek-flash`。
- `AI` 失败会自动降级为规则解析，导入仍可预览/编辑，`ai_runs` 记录失败原因。
- `NOTIFICATION_PROVIDER=wecom`：生产使用企微；`APP_ENV=test` 或 `logging` 使用 Logging Provider。
- `ENCRYPTION_KEY`：用于加密通知 Webhook，必须使用合法 Fernet key。
- `CORS_ORIGINS`：允许的浏览器来源，逗号分隔；带 credentials 时不能使用 `*`。
- `REFRESH_COOKIE_SECURE`：生产默认 `true`；本地 HTTP 开发可设为 `false`。
- `STORAGE_DIR`：本地文件目录；测试使用 `storage_test/`。
- `.env` 不提交；`.env.example` 只保留占位符。

## 接口约定

- API 前缀：`/api/v1`
- 认证：Access Token 走 `Authorization: Bearer`；Refresh Token 只放 `HttpOnly` Cookie（`Path=/api/v1/auth`），响应体不返回 `refresh_token`
- CORS：`CORS_ORIGINS` 白名单 + `allow_credentials`；`/auth/refresh`、`/auth/logout` 校验 `Origin`
- 导入：`POST /imports` 返回 `import_id + job_id`，用 `GET /jobs/{id}` 轮询进度
- 今日：`POST /today/items` 手动加任务；已有空计划会在下次 `GET /today` 自动补齐路线任务
- 路线：`GET /routes` 默认排除 archived，传 `?status=all` 返回全部
- 错误统一为 `{"error": {"code", "message", "details", "request_id"}}`
- 每个响应带 `X-Request-ID`
- 限流：登录 5 次/分钟/IP；导入 3 次/小时/用户；通知测试 5 次/小时/用户
- 常见错误码：`AUTH_INVALID_CREDENTIALS`、`RATE_LIMITED`、`IMPORT_VALIDATION_FAILED`、`NOTIFICATION_CHANNEL_INVALID`、`NOTIFICATION_SEND_FAILED`、`CSRF_ORIGIN_REJECTED`

## 当前阶段

Phase 1 后端 M1–M8 + W0 已完成（W0：安全认证 Cookie、CORS、异步导入 + Job 查询、OpenAPI 导出），并已完成真实 DeepSeek、企业微信 Webhook、Redis/Celery 链路验证与前端联调修复。前端初步联调中；Phase 2/3（代码静态评审、AI 诊断等）不在本仓库当前范围内。
