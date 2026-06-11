"""Analytics and activity endpoints for dashboard pages."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends

from app.core.auth import UserContext, get_current_user
from app.dependencies import get_registry
from app.services.usage_service import UsageService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def get_analytics_overview(
    user: UserContext = Depends(get_current_user),
    reg=Depends(get_registry),
) -> dict[str, Any]:
    """
    Returns aggregated analytics data for the AnalyticsPage.
    Computes: total docs, total chunks, avg chunks/doc, 
    docs by source type, chunk distribution buckets,
    upload timeline (docs per day, last 30 days),
    top documents by chunk count.
    """
    docs = reg.list_documents(owner_id=user.user_id)
    try:
        usage = UsageService.get_usage(user.user_id)
    except Exception:
        # Fallback in case of usage retrieval failure
        usage = {"used": 0, "limit": 50, "percentage": 0, "plan": "free"}

    total_docs = len(docs)
    total_chunks = sum(d.get("chunks", 0) for d in docs)
    avg_chunks = round(total_chunks / total_docs, 1) if total_docs else 0

    # Source type breakdown
    source_counts: dict[str, int] = defaultdict(int)
    for d in docs:
        source_counts[d.get("source_type", "unknown")] += 1

    # Chunk distribution buckets: 0-50, 51-100, 101-200, 201-500, 500+
    buckets = {"0-50": 0, "51-100": 0, "101-200": 0, "201-500": 0, "500+": 0}
    for d in docs:
        c = d.get("chunks", 0)
        if c <= 50:
            buckets["0-50"] += 1
        elif c <= 100:
            buckets["51-100"] += 1
        elif c <= 200:
            buckets["101-200"] += 1
        elif c <= 500:
            buckets["201-500"] += 1
        else:
            buckets["500+"] += 1

    # Upload timeline: group by date for last 30 days
    now = datetime.now(UTC)
    timeline: dict[str, int] = {}
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        timeline[day] = 0
    for d in docs:
        raw = d.get("created_at", "")
        try:
            day = raw[:10]
            if day in timeline:
                timeline[day] += 1
        except Exception:
            pass

    # Top 5 documents by chunk count
    top_docs = sorted(docs, key=lambda x: x.get("chunks", 0), reverse=True)[:5]
    top_docs_out = [
        {
            "document_id": d.get("document_id"),
            "file_name": d.get("file_name"),
            "chunks": d.get("chunks", 0),
            "pages": d.get("pages", 0),
            "created_at": d.get("created_at"),
        }
        for d in top_docs
    ]

    return {
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "avg_chunks_per_doc": avg_chunks,
        "usage": {
            "used": usage.get("used", 0),
            "limit": usage.get("limit", 50),
            "percentage": usage.get("percentage", 0),
            "plan": usage.get("plan", "free"),
        },
        "source_type_breakdown": dict(source_counts),
        "chunk_distribution": buckets,
        "upload_timeline": [
            {"date": k, "count": v} for k, v in timeline.items()
        ],
        "top_documents": top_docs_out,
    }


@router.get("/activity")
def get_activity_feed(
    limit: int = 20,
    user: UserContext = Depends(get_current_user),
    reg=Depends(get_registry),
) -> dict[str, Any]:
    """
    Returns a real activity feed derived from document upload events.
    Each uploaded document = one 'document_uploaded' activity event.
    Sorted by created_at descending. Capped at `limit` items.
    """
    docs = reg.list_documents(owner_id=user.user_id)
    docs_sorted = sorted(
        docs,
        key=lambda d: d.get("created_at", ""),
        reverse=True,
    )[:limit]

    events = []
    for d in docs_sorted:
        events.append({
            "type": "document_uploaded",
            "icon": "upload_file",
            "title": f"Uploaded \"{d.get('file_name', 'Unknown')}\"",
            "description": f"{d.get('chunks', 0)} chunks · {d.get('pages', 0)} pages · {d.get('source_type', 'file')}",
            "timestamp": d.get("created_at"),
            "document_id": d.get("document_id"),
        })

    return {"events": events, "total": len(events)}
