from __future__ import annotations

from datetime import date, datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class RouteCreate(BaseModel):
    job_target_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    daily_capacity_minutes: int | None = Field(default=None, ge=30, le=1440)


class RouteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    daily_capacity_minutes: int | None = Field(default=None, ge=30, le=1440)


class RouteAdjust(BaseModel):
    start_date: date | None = None
    daily_capacity_minutes: int | None = Field(default=None, ge=30, le=1440)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None = None
    learning_objective: str | None = None
    task_type: str
    priority: str
    difficulty: int | None = None
    estimated_minutes: int
    planned_date: date | None = None
    due_date: date | None = None
    deliverable: str
    acceptance_criteria: str
    resources: list[str] | None = Field(
        default=None,
        validation_alias=AliasChoices("resources", "resources_json"),
    )
    capability_tags: list[str] | None = Field(
        default=None,
        validation_alias=AliasChoices("capability_tags", "capability_tags_json"),
    )
    needs_review: bool
    is_splittable: bool
    source_type: str
    source_id: str | None = None
    status: str
    created_at: datetime


class WeekOut(BaseModel):
    id: str
    week_no: int
    focus: str | None = None
    milestone: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    tasks: list[TaskOut] = Field(default_factory=list)


class StageOut(BaseModel):
    id: str
    name: str
    objective: str | None = None
    order_no: int
    start_date: date | None = None
    end_date: date | None = None
    weight: float
    exit_criteria: str | None = None
    weeks: list[WeekOut] = Field(default_factory=list)


class RouteProgress(BaseModel):
    total_tasks: int
    completed_tasks: int
    percent: float


class RouteDetail(BaseModel):
    id: str
    job_target_id: str
    title: str
    description: str | None = None
    status: str
    source_type: str
    start_date: date
    end_date: date
    forecast_end_date: date | None = None
    daily_capacity_minutes: int | None = None
    current_version: int
    progress: RouteProgress
    stages: list[StageOut] = Field(default_factory=list)


class RouteSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_target_id: str
    title: str
    status: str
    start_date: date
    end_date: date
    forecast_end_date: date | None = None
    daily_capacity_minutes: int | None = None
    current_version: int
    created_at: datetime


class StageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    objective: str | None = None
    order_no: int | None = Field(default=None, ge=1)
    start_date: date | None = None
    end_date: date | None = None
    weight: float = Field(default=1.0, ge=0.0, le=100.0)
    exit_criteria: str | None = None


class StageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    objective: str | None = None
    order_no: int | None = Field(default=None, ge=1)
    start_date: date | None = None
    end_date: date | None = None
    weight: float | None = Field(default=None, ge=0.0, le=100.0)
    exit_criteria: str | None = None


class WeekCreate(BaseModel):
    week_no: int | None = Field(default=None, ge=1)
    focus: str | None = Field(default=None, max_length=500)
    milestone: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class WeekUpdate(BaseModel):
    week_no: int | None = Field(default=None, ge=1)
    focus: str | None = Field(default=None, max_length=500)
    milestone: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class TaskCreate(BaseModel):
    route_id: str | None = None
    stage_id: str | None = None
    week_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    learning_objective: str | None = None
    task_type: str = Field(default="fundamentals")
    priority: str = Field(default="P1", pattern="^P[0-2]$")
    difficulty: int | None = Field(default=None, ge=1, le=5)
    estimated_minutes: int = Field(default=45, ge=15, le=120)
    planned_date: date | None = None
    due_date: date | None = None
    deliverable: str = Field(min_length=1)
    acceptance_criteria: str = Field(min_length=1)
    resources: list[str] | None = None
    capability_tags: list[str] | None = None
    is_splittable: bool = True


class TaskUpdate(BaseModel):
    route_id: str | None = None
    stage_id: str | None = None
    week_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    learning_objective: str | None = None
    task_type: str | None = None
    priority: str | None = Field(default=None, pattern="^P[0-2]$")
    difficulty: int | None = Field(default=None, ge=1, le=5)
    estimated_minutes: int | None = Field(default=None, ge=15, le=120)
    planned_date: date | None = None
    due_date: date | None = None
    deliverable: str | None = Field(default=None, min_length=1)
    acceptance_criteria: str | None = Field(default=None, min_length=1)
    resources: list[str] | None = None
    capability_tags: list[str] | None = None
    is_splittable: bool | None = None
    status: str | None = Field(default=None, pattern="^(active|archived)$")


class RouteVersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version_no: int
    change_type: str
    change_summary: str | None = None
    created_at: datetime


class RouteVersionDetail(RouteVersionSummary):
    snapshot: dict
