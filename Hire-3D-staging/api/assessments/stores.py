from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.abstracts import Store
from common.database import get_db

from .models import Assessment, AssessmentGateCheck
from .types import GateName


class AssessmentsStore(Store):
    async def get_by_id(self, assessment_id: UUID) -> Assessment | None:
        result = await self.session.execute(
            select(Assessment).where(Assessment.id == assessment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_engagement(self, engagement_id: UUID) -> Assessment | None:
        result = await self.session.execute(
            select(Assessment).where(Assessment.engagement_id == engagement_id)
        )
        return result.scalar_one_or_none()

    async def create(self, *, engagement_id: UUID, started_by_id: UUID) -> Assessment:
        from common.datetime import get_utc_now

        assessment = Assessment(
            engagement_id=engagement_id,
            phase_1_started_at=get_utc_now(),
            phase_1_started_by_id=started_by_id,
        )
        self.session.add(assessment)
        await self.session.commit()
        await self.session.refresh(assessment)
        return assessment

    async def save(self, assessment: Assessment) -> Assessment:
        await self.session.commit()
        await self.session.refresh(assessment)
        return assessment

    async def list_gate_checks(
        self, *, engagement_id: UUID
    ) -> list[AssessmentGateCheck]:
        result = await self.session.execute(
            select(AssessmentGateCheck)
            .where(AssessmentGateCheck.engagement_id == engagement_id)
            .order_by(AssessmentGateCheck.checked_at.desc())
        )
        return list(result.scalars().all())

    async def record_gate_checks(
        self,
        *,
        engagement_id: UUID,
        assessment_id: UUID | None,
        actor_id: UUID | None,
        results: list[tuple[GateName, bool, str | None]],
    ) -> None:
        from common.datetime import get_utc_now

        now = get_utc_now()
        for gate, passed, reason in results:
            self.session.add(
                AssessmentGateCheck(
                    assessment_id=assessment_id,
                    engagement_id=engagement_id,
                    gate=gate,
                    passed=passed,
                    reason=reason,
                    checked_at=now,
                    actor_id=actor_id,
                )
            )
        await self.session.commit()


async def get_assessments_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AssessmentsStore:
    return AssessmentsStore(session=session)
