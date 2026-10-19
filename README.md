# 恒序 persistLog · Backend

Phase 1 后端：计划导入、每日跟踪、执行看板、企业微信推送。

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
.\.venv\Scripts\python.exe -m pytest
```

## 数据库

- 主库：`persistlog`
- 测试库：`persistlog_test`
- 字符集：`utf8mb4 / utf8mb4_0900_ai_ci`
- DDL 以 `docs/schema.sql` 为准；`alembic` baseline 从该文件生成。

## 当前阶段

Phase 1（M1 骨架进行中）。Phase 2/3 仅保留接口和表设计，不在本轮实现。
