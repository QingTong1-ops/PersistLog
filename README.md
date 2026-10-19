# 恒序 persistLog · Backend

Phase 1 后端：计划导入、路线与任务、每日执行、执行看板、企业微信推送。

产品/技术文档在 `docs/`：

- `docs/01-产品与功能.md`
- `docs/02-技术设计.md`
- `docs/03-后端开发计划.md`
- `docs/schema.sql`

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

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

测试使用 `persistlog_test`，每个 API 测试前后清表；AI 使用 Stub，通知使用 Logging Provider，不访问外网。

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

- `AI_PROVIDER=stub`：本地导入不访问外部模型。
- `NOTIFICATION_PROVIDER=wecom`：生产使用企微；测试环境自动使用 Logging Provider。
- `ENCRYPTION_KEY`：用于加密通知 Webhook，必须使用合法 Fernet key。
- `.env` 不提交；`.env.example` 只保留占位符。

## 接口约定

- API 前缀：`/api/v1`
- 错误统一为 `{"error": {"code", "message", "details", "request_id"}}`
- 每个响应带 `X-Request-ID`
- 限流：登录 5 次/分钟/IP；导入 3 次/小时/用户；通知测试 5 次/小时/用户
- 常见错误码：`AUTH_INVALID_CREDENTIALS`、`RATE_LIMITED`、`IMPORT_VALIDATION_FAILED`、`NOTIFICATION_CHANNEL_INVALID`、`NOTIFICATION_SEND_FAILED`

## 当前阶段

Phase 1 后端 M1–M8 已完成。Phase 2/3（代码静态评审、AI 诊断等）不在本仓库当前范围内。
