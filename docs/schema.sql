-- 恒序 persistLog · Phase 1 数据库 DDL
-- MySQL 8.0+
-- 说明：
-- 1. 时间戳统一存 UTC；DATE 字段按用户时区计算。
-- 2. 主键使用应用层生成的 UUID（char(36)）。
-- 3. 状态字段使用 varchar，取值由应用层 Enum 约束。
-- 4. 完整索引/约束以本文件为准。
-- 5. 本文件只含 Phase 1；Phase 2/3 表结构见 02-技术设计.md 第 4.4/4.5 节。

SET NAMES utf8mb4;

CREATE TABLE users (
  id char(36) NOT NULL,
  email varchar(255) NULL,
  phone varchar(32) NULL,
  password_hash varchar(255) NOT NULL,
  display_name varchar(100) NOT NULL DEFAULT '',
  status varchar(32) NOT NULL DEFAULT 'active' COMMENT 'active/disabled/deleted',
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  last_login_at datetime(3) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at datetime(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  token_hash char(64) NOT NULL,
  device_id char(36) NULL,
  expires_at datetime(3) NOT NULL,
  revoked_at datetime(3) NULL,
  rotated_from char(36) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_refresh_token_hash (token_hash),
  KEY idx_refresh_user_exp (user_id, expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_profiles (
  user_id char(36) NOT NULL,
  education varchar(100) NULL,
  major varchar(100) NULL,
  graduation_year int NULL,
  work_years int NULL,
  tech_stack_json json NULL,
  daily_available_minutes int NOT NULL DEFAULT 120,
  planning_capacity_factor decimal(3,2) NOT NULL DEFAULT 0.80,
  day_boundary_time time NOT NULL DEFAULT '04:00:00',
  preferred_start_time time NULL,
  preferred_end_time time NULL,
  bio text NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_consents (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  scope varchar(64) NOT NULL COMMENT 'ai_import/privacy_policy',
  version varchar(32) NOT NULL,
  granted_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at datetime(3) NULL,
  ip varchar(64) NULL,
  user_agent varchar(500) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_consent (user_id, scope, version),
  KEY idx_consent_user (user_id, scope),
  CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE job_targets (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  title varchar(200) NOT NULL,
  city varchar(100) NULL,
  industry varchar(100) NULL,
  company_type varchar(100) NULL,
  target_date date NULL,
  priority varchar(16) NOT NULL DEFAULT 'P1',
  is_primary tinyint(1) NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'active' COMMENT 'active/archived',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at datetime(3) NULL,
  PRIMARY KEY (id),
  KEY idx_job_targets_user_status (user_id, status),
  KEY idx_job_targets_user_primary (user_id, is_primary),
  CONSTRAINT fk_job_target_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE files (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  storage_key varchar(500) NOT NULL,
  original_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 char(64) NULL,
  status varchar(32) NOT NULL DEFAULT 'uploaded' COMMENT 'uploaded/scanning/ready/failed/deleted',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_files_user_created (user_id, created_at),
  CONSTRAINT fk_file_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_runs (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  run_type varchar(64) NOT NULL,
  provider varchar(64) NULL,
  model varchar(100) NULL,
  prompt_version varchar(64) NULL,
  input_hash char(64) NULL,
  input_snapshot_json json NULL,
  output_json json NULL,
  status varchar(32) NOT NULL DEFAULT 'queued' COMMENT 'queued/running/succeeded/failed',
  token_usage_json json NULL,
  latency_ms int NULL,
  error_code varchar(64) NULL,
  error_detail text NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ai_runs_user_created (user_id, created_at),
  KEY idx_ai_runs_status (status),
  CONSTRAINT fk_ai_run_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE routes (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  job_target_id char(36) NOT NULL,
  title varchar(200) NOT NULL,
  description text NULL,
  status varchar(32) NOT NULL DEFAULT 'draft' COMMENT 'draft/active/paused/completed/archived',
  source_type varchar(32) NOT NULL DEFAULT 'manual' COMMENT 'imported/manual/ai_generated',
  source_id char(36) NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_capacity_minutes int NULL,
  forecast_end_date date NULL,
  current_version int NOT NULL DEFAULT 1,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at datetime(3) NULL,
  PRIMARY KEY (id),
  KEY idx_routes_user_status (user_id, status),
  KEY idx_routes_target_status (job_target_id, status),
  CONSTRAINT fk_route_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_route_target FOREIGN KEY (job_target_id) REFERENCES job_targets (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE route_versions (
  id char(36) NOT NULL,
  route_id char(36) NOT NULL,
  version_no int NOT NULL,
  snapshot_json json NOT NULL,
  change_type varchar(32) NOT NULL COMMENT 'create/import/manual_edit/adjust',
  change_summary varchar(500) NULL,
  created_by char(36) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_route_version (route_id, version_no),
  CONSTRAINT fk_route_version_route FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE route_stages (
  id char(36) NOT NULL,
  route_id char(36) NOT NULL,
  name varchar(200) NOT NULL,
  objective text NULL,
  order_no int NOT NULL,
  start_date date NULL,
  end_date date NULL,
  weight decimal(5,2) NOT NULL DEFAULT 1.00,
  exit_criteria text NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_stage_order (route_id, order_no),
  CONSTRAINT fk_stage_route FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE route_weeks (
  id char(36) NOT NULL,
  stage_id char(36) NOT NULL,
  week_no int NOT NULL,
  focus varchar(500) NULL,
  milestone text NULL,
  start_date date NULL,
  end_date date NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_week_no (stage_id, week_no),
  CONSTRAINT fk_week_stage FOREIGN KEY (stage_id) REFERENCES route_stages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  route_id char(36) NULL,
  stage_id char(36) NULL,
  week_id char(36) NULL,
  title varchar(300) NOT NULL,
  description text NULL,
  learning_objective text NULL,
  task_type varchar(32) NOT NULL,
  priority varchar(16) NOT NULL DEFAULT 'P1' COMMENT 'P0/P1/P2',
  difficulty tinyint NULL,
  estimated_minutes int NOT NULL,
  planned_date date NULL,
  due_date date NULL,
  deliverable text NOT NULL,
  acceptance_criteria text NOT NULL,
  resources_json json NULL,
  capability_tags_json json NULL,
  needs_review tinyint(1) NOT NULL DEFAULT 0,
  is_splittable tinyint(1) NOT NULL DEFAULT 1,
  source_type varchar(32) NOT NULL DEFAULT 'manual' COMMENT 'imported/manual/recurring/ai_generated/review',
  source_id char(36) NULL,
  status varchar(32) NOT NULL DEFAULT 'active' COMMENT 'draft/active/archived',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at datetime(3) NULL,
  PRIMARY KEY (id),
  KEY idx_tasks_user_date_status (user_id, planned_date, status),
  KEY idx_tasks_route (route_id),
  KEY idx_tasks_stage (stage_id),
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_task_route FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE SET NULL,
  CONSTRAINT fk_task_stage FOREIGN KEY (stage_id) REFERENCES route_stages (id) ON DELETE SET NULL,
  CONSTRAINT fk_task_week FOREIGN KEY (week_id) REFERENCES route_weeks (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_dependencies (
  id char(36) NOT NULL,
  task_id char(36) NOT NULL,
  depends_on_task_id char(36) NOT NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_dependency (task_id, depends_on_task_id),
  KEY idx_dependency_depends (depends_on_task_id),
  CONSTRAINT fk_dependency_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT fk_dependency_depends FOREIGN KEY (depends_on_task_id) REFERENCES tasks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recurring_rules (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  name varchar(200) NOT NULL,
  rule_type varchar(32) NOT NULL COMMENT 'daily/weekly/interval',
  interval_days int NULL,
  weekdays_json json NULL,
  start_date date NOT NULL,
  end_date date NULL,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  task_template_json json NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_recurring_user_enabled (user_id, enabled),
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE daily_plans (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  plan_date date NOT NULL,
  capacity_minutes int NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'generated' COMMENT 'generated/active/completed',
  generated_at datetime(3) NULL,
  generation_version int NOT NULL DEFAULT 1,
  summary_json json NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_daily_plan (user_id, plan_date),
  CONSTRAINT fk_daily_plan_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_occurrences (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  task_id char(36) NOT NULL,
  daily_plan_id char(36) NULL,
  occurrence_date date NOT NULL,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  status varchar(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/in_progress/completed/pending_review/reviewed/postponed/skipped/blocked/abandoned',
  priority_snapshot varchar(16) NULL,
  planned_minutes int NOT NULL,
  actual_minutes int NULL,
  remaining_minutes int NOT NULL DEFAULT 0,
  carry_over_from_id char(36) NULL,
  postpone_count int NOT NULL DEFAULT 0,
  skip_reason varchar(500) NULL,
  block_reason varchar(500) NULL,
  note text NULL,
  started_at datetime(3) NULL,
  completed_at datetime(3) NULL,
  reviewed_at datetime(3) NULL,
  split_index int NOT NULL DEFAULT 0,
  parent_occurrence_id char(36) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_occurrence (user_id, task_id, occurrence_date, split_index),
  KEY idx_occurrence_user_date_status (user_id, occurrence_date, status),
  KEY idx_occurrence_user_status_remaining (user_id, status, remaining_minutes),
  KEY idx_occurrence_plan (daily_plan_id),
  CONSTRAINT fk_occurrence_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_occurrence_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT,
  CONSTRAINT fk_occurrence_plan FOREIGN KEY (daily_plan_id) REFERENCES daily_plans (id) ON DELETE SET NULL,
  CONSTRAINT fk_occurrence_carry FOREIGN KEY (carry_over_from_id) REFERENCES task_occurrences (id) ON DELETE SET NULL,
  CONSTRAINT fk_occurrence_parent FOREIGN KEY (parent_occurrence_id) REFERENCES task_occurrences (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE daily_plan_items (
  id char(36) NOT NULL,
  daily_plan_id char(36) NOT NULL,
  task_occurrence_id char(36) NOT NULL,
  order_no int NOT NULL,
  planned_minutes int NOT NULL,
  is_optional tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_plan_item (daily_plan_id, task_occurrence_id),
  KEY idx_plan_item_occurrence (task_occurrence_id),
  CONSTRAINT fk_plan_item_plan FOREIGN KEY (daily_plan_id) REFERENCES daily_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_item_occurrence FOREIGN KEY (task_occurrence_id) REFERENCES task_occurrences (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE import_batches (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  file_id char(36) NOT NULL,
  format varchar(16) NOT NULL DEFAULT 'markdown' COMMENT 'markdown/html',
  status varchar(32) NOT NULL DEFAULT 'uploaded' COMMENT 'uploaded/parsing/needs_review/confirmed/failed/cancelled/rolled_back',
  parser_version varchar(32) NULL,
  ai_run_id char(36) NULL,
  created_route_id char(36) NULL,
  summary_json json NULL,
  error_json json NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_import_user_created (user_id, created_at),
  KEY idx_import_status (status),
  CONSTRAINT fk_import_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_import_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE RESTRICT,
  CONSTRAINT fk_import_ai_run FOREIGN KEY (ai_run_id) REFERENCES ai_runs (id) ON DELETE SET NULL,
  CONSTRAINT fk_import_route FOREIGN KEY (created_route_id) REFERENCES routes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE import_items (
  id char(36) NOT NULL,
  batch_id char(36) NOT NULL,
  source_locator varchar(500) NULL,
  normalized_json json NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'valid' COMMENT 'valid/invalid/confirmed/skipped',
  error_json json NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_import_item_batch (batch_id, status),
  CONSTRAINT fk_import_item_batch FOREIGN KEY (batch_id) REFERENCES import_batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE import_issues (
  id char(36) NOT NULL,
  batch_id char(36) NOT NULL,
  item_id char(36) NULL,
  severity varchar(16) NOT NULL COMMENT 'error/warning',
  code varchar(64) NOT NULL,
  message varchar(500) NOT NULL,
  suggestion varchar(500) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_import_issue_batch (batch_id, severity),
  CONSTRAINT fk_import_issue_batch FOREIGN KEY (batch_id) REFERENCES import_batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_import_issue_item FOREIGN KEY (item_id) REFERENCES import_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_channels (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  channel_type varchar(32) NOT NULL DEFAULT 'wecom_group_bot',
  name varchar(100) NOT NULL,
  config_ciphertext text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active' COMMENT 'active/disabled/error',
  quiet_hours_json json NULL,
  last_test_at datetime(3) NULL,
  last_error varchar(500) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_channel_user_status (user_id, status),
  CONSTRAINT fk_channel_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_templates (
  id char(36) NOT NULL,
  code varchar(64) NOT NULL,
  channel_type varchar(32) NOT NULL,
  locale varchar(16) NOT NULL DEFAULT 'zh-CN',
  subject varchar(200) NULL,
  body text NOT NULL,
  version int NOT NULL DEFAULT 1,
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_notification_template (code, channel_type, locale, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_preferences (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  event_type varchar(64) NOT NULL,
  channel_id char(36) NOT NULL,
  enabled tinyint(1) NOT NULL DEFAULT 1,
  send_time time NULL,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Shanghai',
  quiet_hours_behavior varchar(32) NOT NULL DEFAULT 'delay' COMMENT 'delay/drop',
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_notification_pref (user_id, event_type, channel_id),
  CONSTRAINT fk_notification_pref_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_pref_channel FOREIGN KEY (channel_id) REFERENCES notification_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_outbox (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  channel_id char(36) NOT NULL,
  template_code varchar(64) NOT NULL,
  payload_json json NOT NULL,
  dedup_key varchar(200) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending' COMMENT 'pending/sending/sent/failed/dead',
  retry_count int NOT NULL DEFAULT 0,
  next_retry_at datetime(3) NULL,
  sent_at datetime(3) NULL,
  last_error varchar(500) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_notification_dedup (user_id, dedup_key),
  KEY idx_outbox_status_retry (status, next_retry_at),
  CONSTRAINT fk_outbox_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_outbox_channel FOREIGN KEY (channel_id) REFERENCES notification_channels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE jobs (
  id char(36) NOT NULL,
  user_id char(36) NOT NULL,
  job_type varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'queued' COMMENT 'queued/running/succeeded/failed/cancelled',
  progress decimal(5,2) NOT NULL DEFAULT 0.00,
  result_ref varchar(200) NULL,
  error_json json NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_jobs_user_type (user_id, job_type, created_at),
  KEY idx_jobs_status (status),
  CONSTRAINT fk_job_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE audit_logs (
  id char(36) NOT NULL,
  user_id char(36) NULL,
  actor_type varchar(32) NOT NULL COMMENT 'user/admin/system/ai',
  actor_id char(36) NULL,
  action varchar(64) NOT NULL,
  target_type varchar(64) NULL,
  target_id char(36) NULL,
  before_json json NULL,
  after_json json NULL,
  request_id varchar(64) NULL,
  ip varchar(64) NULL,
  user_agent varchar(500) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_user_created (user_id, created_at),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 默认通知模板（V1 企微群机器人）
INSERT IGNORE INTO notification_templates
  (id, code, channel_type, locale, subject, body, version, status)
VALUES
  (UUID(), 'morning', 'wecom_group_bot', 'zh-CN', '恒序 · 今日',
   '### 恒序 · 今日 {date}\n> 今日 {planned_tasks} 项，预计 {planned_minutes} 分钟\n\n**重点**：{focus}\n\n完成 2/3 即达标。\n\n[打开今日]({today_link})',
   1, 'active'),
  (UUID(), 'evening', 'wecom_group_bot', 'zh-CN', '恒序 · 收尾',
   '### 恒序 · 收尾\n今日完成 {completed_tasks}/{planned_tasks}，完成率 {completion_rate}\n实际 {actual_minutes} 分钟｜顺延 {carry_count} 项\n\n[打开今日]({today_link})',
   1, 'active'),
  (UUID(), 'overdue', 'wecom_group_bot', 'zh-CN', '恒序 · 逾期提醒',
   '### 恒序 · 逾期提醒\n你有 {overdue_count} 项任务已逾期。\n\n建议先处理逾期任务，再开新任务。\n\n[打开今日]({today_link})',
   1, 'active'),
  (UUID(), 'carry_over', 'wecom_group_bot', 'zh-CN', '恒序 · 顺延提醒',
   '### 恒序 · 顺延提醒\n{carry_count} 项任务移到今天。\n预计完成日期：{forecast_date}\n\n[打开今日]({today_link})',
   1, 'active'),
  (UUID(), 'weekly', 'wecom_group_bot', 'zh-CN', '恒序 · 周总结',
   '### 恒序 · 周总结\n本周完成率 {completion_rate}｜活跃 {active_days} 天\n实际 {actual_minutes} 分钟｜顺延 {carry_count} 项\n下周重点：{next_focus}\n\n[打开看板]({dashboard_link})',
   1, 'active');
