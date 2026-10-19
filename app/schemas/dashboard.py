from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class RouteProgressOut(BaseModel):
    total_tasks: int
    completed_tasks: int
    percent: float


class DashboardOverview(BaseModel):
    start_date: date
    end_date: date
    timezone: str
    planned_tasks: int
    completed_tasks: int
    completion_rate: float
    planned_minutes: int
    actual_minutes: int
    carry_over_count: int
    carry_over_rate: float
    active_routes: int
    route_progress: RouteProgressOut


class TrendPoint(BaseModel):
    date: date
    planned_tasks: int
    completed_tasks: int
    completion_rate: float
    planned_minutes: int
    actual_minutes: int
    carry_over_count: int


class TrendResponse(BaseModel):
    start_date: date
    end_date: date
    timezone: str
    points: list[TrendPoint] = Field(default_factory=list)


class DistributionBucket(BaseModel):
    key: str
    label: str
    planned_tasks: int
    completed_tasks: int
    planned_minutes: int
    actual_minutes: int


class DistributionResponse(BaseModel):
    start_date: date
    end_date: date
    timezone: str
    by_task_type: list[DistributionBucket] = Field(default_factory=list)
    by_route: list[DistributionBucket] = Field(default_factory=list)
    by_status: list[DistributionBucket] = Field(default_factory=list)
    by_priority: list[DistributionBucket] = Field(default_factory=list)


class ForecastRoute(BaseModel):
    route_id: str
    title: str
    remaining_minutes: int
    forecast_end_date: date


class DashboardForecast(BaseModel):
    generated_at: datetime
    timezone: str
    throughput_minutes: int
    remaining_minutes: int
    forecast_days: int
    forecast_end_date: date
    routes: list[ForecastRoute] = Field(default_factory=list)
