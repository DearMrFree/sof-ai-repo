"""Academic planner API — students save and track MIT OCW courses.

A plan item moves through: interested → planned → in_progress → completed.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..db import get_session
from ..models import AcademicPlanItem, MitOcwCourse

router = APIRouter(prefix="/planner", tags=["planner"])

_VALID_STATUSES = {"interested", "planned", "in_progress", "completed"}


class PlanItemOut(BaseModel):
    id: int
    user_id: str
    course_id: int
    course_title: str
    course_number: str
    course_url: str
    department: str
    level: str
    status: str
    notes: str
    added_at: datetime
    updated_at: datetime


class AddItemRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    course_id: int


class UpdateItemRequest(BaseModel):
    status: str | None = None
    notes: str | None = None


def _to_out(item: AcademicPlanItem, course: MitOcwCourse | None) -> PlanItemOut:
    return PlanItemOut(
        id=item.id,  # type: ignore[arg-type]
        user_id=item.user_id,
        course_id=item.course_id,
        course_title=course.title if course else "",
        course_number=course.course_number if course else "",
        course_url=course.url if course else "",
        department=course.department if course else "",
        level=course.level if course else "",
        status=item.status,
        notes=item.notes,
        added_at=item.added_at,
        updated_at=item.updated_at,
    )


@router.get("/items", response_model=list[PlanItemOut])
def get_plan(
    user_id: str = Query(..., min_length=1),
    status: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[PlanItemOut]:
    """Get all plan items for a student, optionally filtered by status."""
    stmt = select(AcademicPlanItem).where(AcademicPlanItem.user_id == user_id)
    if status:
        stmt = stmt.where(AcademicPlanItem.status == status)
    items = session.exec(stmt).all()
    out: list[PlanItemOut] = []
    for item in items:
        course = session.get(MitOcwCourse, item.course_id)
        out.append(_to_out(item, course))
    return out


@router.post("/items", response_model=PlanItemOut)
def add_item(
    body: AddItemRequest,
    session: Session = Depends(get_session),
) -> PlanItemOut:
    """Add a course to a student's academic plan (idempotent)."""
    course = session.get(MitOcwCourse, body.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = session.exec(
        select(AcademicPlanItem).where(
            AcademicPlanItem.user_id == body.user_id,
            AcademicPlanItem.course_id == body.course_id,
        )
    ).first()
    if existing:
        return _to_out(existing, course)

    item = AcademicPlanItem(user_id=body.user_id, course_id=body.course_id)
    session.add(item)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.exec(
            select(AcademicPlanItem).where(
                AcademicPlanItem.user_id == body.user_id,
                AcademicPlanItem.course_id == body.course_id,
            )
        ).first()
        if existing:
            return _to_out(existing, course)
        raise
    session.refresh(item)
    return _to_out(item, course)


@router.patch("/items/{item_id}", response_model=PlanItemOut)
def update_item(
    item_id: int,
    body: UpdateItemRequest,
    user_id: str = Query(..., min_length=1),
    session: Session = Depends(get_session),
) -> PlanItemOut:
    """Update status or notes on a plan item. user_id must match the owner."""
    item = session.get(AcademicPlanItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Plan item not found")

    if body.status is not None:
        if body.status not in _VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"status must be one of {sorted(_VALID_STATUSES)}")
        item.status = body.status
    if body.notes is not None:
        item.notes = body.notes
    item.updated_at = datetime.now(UTC)
    session.add(item)
    session.commit()
    session.refresh(item)
    course = session.get(MitOcwCourse, item.course_id)
    return _to_out(item, course)


@router.delete("/items/{item_id}", status_code=204)
def remove_item(
    item_id: int,
    user_id: str = Query(..., min_length=1),
    session: Session = Depends(get_session),
) -> None:
    """Remove a course from a student's plan."""
    item = session.get(AcademicPlanItem, item_id)
    if not item or item.user_id != user_id:
        raise HTTPException(status_code=404, detail="Plan item not found")
    session.delete(item)
    session.commit()
