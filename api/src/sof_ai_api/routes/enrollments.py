"""Enrollment routes — student-professor learning relationships.

The Enrollment model is the durable counterpart to AgentApplication:
applications gate-keep entry, enrollments persist the actual mentorship
relationship, with a roster of professors (human + AI), progress notes,
and a status that can be paused/resumed/graduated over years.

Surface:
  * POST   /enrollments                  — create (internal-auth)
  * GET    /enrollments                  — list (public; filterable)
  * GET    /enrollments/{id}             — detail with professor roster (public)
  * POST   /enrollments/{id}/professors  — add a professor (internal-auth)
  * DELETE /enrollments/{id}/professors/{professor_id} — remove (internal-auth)
  * PATCH  /enrollments/{id}             — update status/notes/track (internal-auth)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..models import StudentEnrollment, StudentProfessor, _utcnow
from .wallet import require_internal_auth

router = APIRouter(prefix="/student-enrollments", tags=["student-enrollments"])


# ---------------------------------------------------------------------------
# Pydantic IO
# ---------------------------------------------------------------------------


class ProfessorIn(BaseModel):
    professor_email: str = Field(..., min_length=3, max_length=200)
    professor_name: str = Field(default="", max_length=200)
    professor_kind: str = Field(default="human", pattern="^(human|ai)$")
    role: str = Field(default="lead", pattern="^(lead|co_lead|guest)$")


class ProfessorOut(BaseModel):
    id: int
    student_enrollment_id: int
    professor_email: str
    professor_name: str
    professor_kind: str
    role: str
    added_at: str


class CreateEnrollmentIn(BaseModel):
    application_id: Optional[int] = None
    student_name: str = Field(..., min_length=1, max_length=200)
    student_email: str = Field(..., min_length=3, max_length=200)
    agent_name: str = Field(default="", max_length=200)
    agent_url: str = Field(default="", max_length=400)
    track: str = Field(default="", max_length=200)
    status: str = Field(
        default="active", pattern="^(active|paused|graduated|withdrawn)$"
    )
    notes: str = Field(default="")
    professors: list[ProfessorIn] = Field(default_factory=list)


class UpdateEnrollmentIn(BaseModel):
    status: Optional[str] = Field(
        default=None, pattern="^(active|paused|graduated|withdrawn)$"
    )
    track: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None
    agent_name: Optional[str] = Field(default=None, max_length=200)
    agent_url: Optional[str] = Field(default=None, max_length=400)


class EnrollmentOut(BaseModel):
    id: int
    application_id: Optional[int]
    student_name: str
    student_email: str
    agent_name: str
    agent_url: str
    track: str
    status: str
    notes: str
    started_at: str
    updated_at: str
    professors: list[ProfessorOut]


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


def _serialize_professor(p: StudentProfessor) -> ProfessorOut:
    return ProfessorOut(
        id=p.id or 0,
        student_enrollment_id=p.student_enrollment_id,
        professor_email=p.professor_email,
        professor_name=p.professor_name,
        professor_kind=p.professor_kind,
        role=p.role,
        added_at=p.added_at.isoformat() if p.added_at else "",
    )


def _serialize_enrollment(
    e: StudentEnrollment, professors: list[StudentProfessor]
) -> EnrollmentOut:
    return EnrollmentOut(
        id=e.id or 0,
        application_id=e.application_id,
        student_name=e.student_name,
        student_email=e.student_email,
        agent_name=e.agent_name,
        agent_url=e.agent_url,
        track=e.track,
        status=e.status,
        notes=e.notes,
        started_at=e.started_at.isoformat() if e.started_at else "",
        updated_at=e.updated_at.isoformat() if e.updated_at else "",
        professors=[_serialize_professor(p) for p in professors],
    )


def _load_professors(
    session: Session, enrollment_id: int
) -> list[StudentProfessor]:
    return list(
        session.exec(
            select(StudentProfessor)
            .where(StudentProfessor.student_enrollment_id == enrollment_id)
            .order_by(StudentProfessor.added_at)
        ).all()
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=EnrollmentOut,
    status_code=201,
    dependencies=[Depends(require_internal_auth)],
)
def create_enrollment(
    body: CreateEnrollmentIn,
    session: Session = Depends(get_session),
) -> EnrollmentOut:
    """Create a new Enrollment + initial professor roster.

    Idempotent on (application_id) when one is provided: a second call
    with the same application_id returns the existing enrollment with
    any new professors merged in by (email, role).
    """
    existing: Optional[StudentEnrollment] = None
    if body.application_id is not None:
        existing = session.exec(
            select(StudentEnrollment).where(
                StudentEnrollment.application_id == body.application_id
            )
        ).first()

    now = _utcnow()
    if existing is None:
        e = StudentEnrollment(
            application_id=body.application_id,
            student_name=body.student_name,
            student_email=body.student_email.strip().lower(),
            agent_name=body.agent_name,
            agent_url=body.agent_url,
            track=body.track,
            status=body.status,
            notes=body.notes,
            started_at=now,
            updated_at=now,
        )
        session.add(e)
        session.commit()
        session.refresh(e)
    else:
        e = existing

    # Merge professors by (email, role) — re-adding the same row is a no-op.
    existing_professors = _load_professors(session, e.id or 0)
    seen = {(p.professor_email.lower(), p.role) for p in existing_professors}
    for prof in body.professors:
        key = (prof.professor_email.strip().lower(), prof.role)
        if key in seen:
            continue
        session.add(
            StudentProfessor(
                student_enrollment_id=e.id or 0,
                professor_email=prof.professor_email.strip().lower(),
                professor_name=prof.professor_name,
                professor_kind=prof.professor_kind,
                role=prof.role,
                added_at=now,
            )
        )
        seen.add(key)
    session.commit()

    return _serialize_enrollment(e, _load_professors(session, e.id or 0))


@router.get("", response_model=list[EnrollmentOut])
def list_enrollments(
    status: Optional[str] = None,
    track: Optional[str] = None,
    limit: int = 100,
    session: Session = Depends(get_session),
) -> list[EnrollmentOut]:
    """List enrollments. Filterable by status + track.

    Public read — sof.ai shows enrolled students on the /enrollments page
    so the community can see who's actively learning.
    """
    limit = max(1, min(limit, 500))
    q = select(StudentEnrollment)
    if status:
        q = q.where(StudentEnrollment.status == status)
    if track:
        q = q.where(StudentEnrollment.track == track)
    q = q.order_by(StudentEnrollment.started_at.desc()).limit(limit)  # type: ignore[union-attr]
    rows = list(session.exec(q).all())
    return [
        _serialize_enrollment(e, _load_professors(session, e.id or 0))
        for e in rows
    ]


@router.get("/{enrollment_id}", response_model=EnrollmentOut)
def get_enrollment(
    enrollment_id: int,
    session: Session = Depends(get_session),
) -> EnrollmentOut:
    e = session.get(StudentEnrollment, enrollment_id)
    if not e:
        raise HTTPException(status_code=404, detail="enrollment not found")
    return _serialize_enrollment(e, _load_professors(session, e.id or 0))


@router.patch(
    "/{enrollment_id}",
    response_model=EnrollmentOut,
    dependencies=[Depends(require_internal_auth)],
)
def update_enrollment(
    enrollment_id: int,
    body: UpdateEnrollmentIn,
    session: Session = Depends(get_session),
) -> EnrollmentOut:
    e = session.get(StudentEnrollment, enrollment_id)
    if not e:
        raise HTTPException(status_code=404, detail="enrollment not found")
    if body.status is not None:
        e.status = body.status
    if body.track is not None:
        e.track = body.track
    if body.notes is not None:
        e.notes = body.notes
    if body.agent_name is not None:
        e.agent_name = body.agent_name
    if body.agent_url is not None:
        e.agent_url = body.agent_url
    e.updated_at = _utcnow()
    session.add(e)
    session.commit()
    session.refresh(e)
    return _serialize_enrollment(e, _load_professors(session, e.id or 0))


@router.post(
    "/{enrollment_id}/professors",
    response_model=ProfessorOut,
    status_code=201,
    dependencies=[Depends(require_internal_auth)],
)
def add_professor(
    enrollment_id: int,
    body: ProfessorIn,
    session: Session = Depends(get_session),
) -> ProfessorOut:
    e = session.get(StudentEnrollment, enrollment_id)
    if not e:
        raise HTTPException(status_code=404, detail="enrollment not found")
    email = body.professor_email.strip().lower()
    # Upsert by (enrollment_id, email, role) — idempotent.
    existing = session.exec(
        select(StudentProfessor).where(
            StudentProfessor.student_enrollment_id == enrollment_id,
            StudentProfessor.professor_email == email,
            StudentProfessor.role == body.role,
        )
    ).first()
    if existing:
        return _serialize_professor(existing)
    p = StudentProfessor(
        student_enrollment_id=enrollment_id,
        professor_email=email,
        professor_name=body.professor_name,
        professor_kind=body.professor_kind,
        role=body.role,
        added_at=_utcnow(),
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    e.updated_at = _utcnow()
    session.add(e)
    session.commit()
    return _serialize_professor(p)


@router.delete(
    "/{enrollment_id}/professors/{professor_id}",
    status_code=204,
    dependencies=[Depends(require_internal_auth)],
)
def remove_professor(
    enrollment_id: int,
    professor_id: int,
    session: Session = Depends(get_session),
) -> None:
    p = session.get(StudentProfessor, professor_id)
    if not p or p.student_enrollment_id != enrollment_id:
        raise HTTPException(status_code=404, detail="professor not found")
    session.delete(p)
    session.commit()
