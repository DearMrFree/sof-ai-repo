"""Catalog API — browse and search MIT OpenCourseWare courses.

All course data is © MIT OpenCourseWare, CC BY-NC-SA 4.0.
"""

from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, col, select

from ..db import get_session
from ..models import MitOcwCourse

router = APIRouter(prefix="/catalog", tags=["catalog"])


class CourseOut(BaseModel):
    id: int
    ocw_id: str
    course_number: str
    title: str
    description: str
    url: str
    thumbnail_url: str
    department: str
    level: str
    subjects: list[str]
    instructors: list[str]
    semester: str
    year: Optional[int]
    has_video: bool
    has_assignments: bool


class CourseListOut(BaseModel):
    total: int
    offset: int
    limit: int
    results: list[CourseOut]


def _to_out(c: MitOcwCourse) -> CourseOut:
    return CourseOut(
        id=c.id,  # type: ignore[arg-type]
        ocw_id=c.ocw_id,
        course_number=c.course_number,
        title=c.title,
        description=c.description,
        url=c.url,
        thumbnail_url=c.thumbnail_url,
        department=c.department,
        level=c.level,
        subjects=json.loads(c.subjects_json or "[]"),
        instructors=json.loads(c.instructors_json or "[]"),
        semester=c.semester,
        year=c.year,
        has_video=c.has_video,
        has_assignments=c.has_assignments,
    )


@router.get("/courses", response_model=CourseListOut)
def list_courses(
    department: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    has_video: Optional[bool] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    session: Session = Depends(get_session),
) -> CourseListOut:
    """Paginated course list with optional filters."""
    stmt = select(MitOcwCourse)
    if department:
        stmt = stmt.where(col(MitOcwCourse.department).icontains(department))
    if level:
        stmt = stmt.where(MitOcwCourse.level == level)
    if has_video is not None:
        stmt = stmt.where(MitOcwCourse.has_video == has_video)

    all_rows = session.exec(stmt).all()
    total = len(all_rows)
    page = all_rows[offset : offset + limit]
    return CourseListOut(total=total, offset=offset, limit=limit, results=[_to_out(c) for c in page])


@router.get("/courses/search", response_model=CourseListOut)
def search_courses(
    q: str = Query(..., min_length=1),
    department: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    session: Session = Depends(get_session),
) -> CourseListOut:
    """Full-text search across title, description, subjects, course_number, and department."""
    term = q.lower().strip()
    stmt = select(MitOcwCourse)
    if department:
        stmt = stmt.where(col(MitOcwCourse.department).icontains(department))
    if level:
        stmt = stmt.where(MitOcwCourse.level == level)

    all_rows = session.exec(stmt).all()
    matched = [
        c for c in all_rows
        if term in c.title.lower()
        or term in c.description.lower()
        or term in c.course_number.lower()
        or term in c.department.lower()
        or term in (c.subjects_json or "").lower()
        or term in (c.instructors_json or "").lower()
    ]
    total = len(matched)
    page = matched[offset : offset + limit]
    return CourseListOut(total=total, offset=offset, limit=limit, results=[_to_out(c) for c in page])


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    session: Session = Depends(get_session),
) -> CourseOut:
    course = session.get(MitOcwCourse, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _to_out(course)


@router.get("/departments", response_model=list[str])
def list_departments(session: Session = Depends(get_session)) -> list[str]:
    """Return sorted list of all distinct departments in the catalog."""
    rows = session.exec(select(MitOcwCourse.department)).all()
    return sorted({r for r in rows if r})


@router.get("/levels", response_model=list[str])
def list_levels(session: Session = Depends(get_session)) -> list[str]:
    """Return sorted list of all distinct levels in the catalog."""
    rows = session.exec(select(MitOcwCourse.level)).all()
    return sorted({r for r in rows if r})
