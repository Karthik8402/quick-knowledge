"""Tests for /api/v1/analytics endpoints.

Covers:
  - GET /analytics/overview  (empty state, single doc, multi-doc, bucket distribution,
    timeline grouping, top-5 ranking, usage integration)
  - GET /analytics/activity  (empty state, event shape, ordering, limit param)
  - Auth guard (401 when AUTH_ENABLED=true)
"""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_doc(
    doc_id: str = "doc-001",
    file_name: str = "test.pdf",
    source_type: str = "pdf",
    pages: int = 5,
    chunks: int = 20,
    owner_id: str = "anonymous",
    days_ago: int = 0,
) -> dict:
    """Build a minimal document registry record."""
    created = (datetime.now(UTC) - timedelta(days=days_ago)).isoformat()
    return {
        "document_id": doc_id,
        "file_name": file_name,
        "source_type": source_type,
        "pages": pages,
        "chunks": chunks,
        "content_hash": f"hash-{doc_id}",
        "owner_id": owner_id,
        "created_at": created,
    }


MOCK_USAGE = {"used": 10, "limit": 50, "percentage": 20, "plan": "free"}


# ---------------------------------------------------------------------------
# /analytics/overview — empty state
# ---------------------------------------------------------------------------
class TestAnalyticsOverviewEmpty:
    def test_empty_registry_returns_zeros(self, test_client: TestClient):
        """No documents → all numeric fields are 0, collections are empty."""
        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        assert resp.status_code == 200
        data = resp.json()

        assert data["total_documents"] == 0
        assert data["total_chunks"] == 0
        assert data["avg_chunks_per_doc"] == 0
        assert data["top_documents"] == []
        assert data["upload_timeline"] != []  # 30 entries always present
        assert all(entry["count"] == 0 for entry in data["upload_timeline"])

    def test_timeline_always_has_30_entries(self, test_client: TestClient):
        """Timeline must always return exactly 30 date entries."""
        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        assert resp.status_code == 200
        timeline = resp.json()["upload_timeline"]
        assert len(timeline) == 30

    def test_timeline_dates_are_consecutive(self, test_client: TestClient):
        """Timeline dates must be consecutive calendar days, oldest first."""
        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        dates = [entry["date"] for entry in resp.json()["upload_timeline"]]
        for i in range(1, len(dates)):
            prev = datetime.strptime(dates[i - 1], "%Y-%m-%d")
            curr = datetime.strptime(dates[i], "%Y-%m-%d")
            assert (curr - prev).days == 1, f"Gap between {dates[i-1]} and {dates[i]}"


# ---------------------------------------------------------------------------
# /analytics/overview — single document
# ---------------------------------------------------------------------------
class TestAnalyticsOverviewSingleDoc:
    def test_single_doc_counts(self, test_client: TestClient, tmp_registry):
        """One uploaded document → correct totals and avg."""
        tmp_registry.upsert(_make_doc("d1", chunks=40, pages=3))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        assert resp.status_code == 200
        data = resp.json()
        assert data["total_documents"] == 1
        assert data["total_chunks"] == 40
        assert data["avg_chunks_per_doc"] == 40.0

    def test_single_doc_in_top_documents(self, test_client: TestClient, tmp_registry):
        """A single document must appear in top_documents list."""
        tmp_registry.upsert(_make_doc("d1", file_name="myfile.pdf", chunks=40))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        top = resp.json()["top_documents"]
        assert len(top) == 1
        assert top[0]["file_name"] == "myfile.pdf"
        assert top[0]["chunks"] == 40

    def test_source_type_breakdown_single(self, test_client: TestClient, tmp_registry):
        """Source type breakdown must include the doc's source type."""
        tmp_registry.upsert(_make_doc("d1", source_type="pdf", chunks=10))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        breakdown = resp.json()["source_type_breakdown"]
        assert breakdown.get("pdf") == 1

    def test_today_upload_counted_in_timeline(self, test_client: TestClient, tmp_registry):
        """A document uploaded today must increment today's timeline entry."""
        tmp_registry.upsert(_make_doc("d1", days_ago=0))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        today = datetime.now(UTC).strftime("%Y-%m-%d")
        timeline = {e["date"]: e["count"] for e in resp.json()["upload_timeline"]}
        assert timeline.get(today, 0) == 1


# ---------------------------------------------------------------------------
# /analytics/overview — multiple documents
# ---------------------------------------------------------------------------
class TestAnalyticsOverviewMultiDoc:
    def test_avg_chunks_rounded_to_one_decimal(self, test_client: TestClient, tmp_registry):
        """avg_chunks_per_doc must be rounded to 1 decimal place."""
        tmp_registry.upsert(_make_doc("d1", chunks=10))
        tmp_registry.upsert(_make_doc("d2", chunks=20))
        tmp_registry.upsert(_make_doc("d3", chunks=30))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        assert resp.json()["avg_chunks_per_doc"] == 20.0

    def test_top_documents_capped_at_five(self, test_client: TestClient, tmp_registry):
        """top_documents must never return more than 5 entries."""
        for i in range(8):
            tmp_registry.upsert(_make_doc(f"d{i}", chunks=10 * (i + 1)))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        assert len(resp.json()["top_documents"]) <= 5

    def test_top_documents_sorted_descending(self, test_client: TestClient, tmp_registry):
        """top_documents must be sorted by chunk count descending."""
        tmp_registry.upsert(_make_doc("d1", chunks=5))
        tmp_registry.upsert(_make_doc("d2", chunks=80))
        tmp_registry.upsert(_make_doc("d3", chunks=30))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        chunks = [d["chunks"] for d in resp.json()["top_documents"]]
        assert chunks == sorted(chunks, reverse=True)

    def test_source_type_breakdown_aggregates_correctly(
        self, test_client: TestClient, tmp_registry
    ):
        """Mixed source types must be counted per type."""
        tmp_registry.upsert(_make_doc("d1", source_type="pdf"))
        tmp_registry.upsert(_make_doc("d2", source_type="pdf"))
        tmp_registry.upsert(_make_doc("d3", source_type="url"))
        tmp_registry.upsert(_make_doc("d4", source_type="txt"))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        breakdown = resp.json()["source_type_breakdown"]
        assert breakdown["pdf"] == 2
        assert breakdown["url"] == 1
        assert breakdown["txt"] == 1

    def test_timeline_groups_by_upload_date(self, test_client: TestClient, tmp_registry):
        """Three docs uploaded 5 days ago → that day's count must be 3."""
        for i in range(3):
            tmp_registry.upsert(_make_doc(f"d{i}", days_ago=5))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        target_date = (datetime.now(UTC) - timedelta(days=5)).strftime("%Y-%m-%d")
        timeline = {e["date"]: e["count"] for e in resp.json()["upload_timeline"]}
        assert timeline.get(target_date, 0) == 3

    def test_old_docs_not_in_30day_timeline(self, test_client: TestClient, tmp_registry):
        """Documents uploaded 40 days ago must not appear in the 30-day window."""
        tmp_registry.upsert(_make_doc("d1", days_ago=40))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        total = sum(e["count"] for e in resp.json()["upload_timeline"])
        assert total == 0


# ---------------------------------------------------------------------------
# /analytics/overview — chunk distribution buckets
# ---------------------------------------------------------------------------
class TestChunkDistributionBuckets:
    @pytest.mark.parametrize(
        "chunks,expected_bucket",
        [
            (0, "0-50"),
            (50, "0-50"),
            (51, "51-100"),
            (100, "51-100"),
            (101, "101-200"),
            (200, "101-200"),
            (201, "201-500"),
            (500, "201-500"),
            (501, "500+"),
            (9999, "500+"),
        ],
    )
    def test_bucket_boundaries(
        self,
        test_client: TestClient,
        tmp_registry,
        chunks: int,
        expected_bucket: str,
    ):
        """Verify exact boundary assignment for each distribution bucket."""
        tmp_registry.upsert(_make_doc("d1", chunks=chunks))

        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        dist = resp.json()["chunk_distribution"]
        assert dist[expected_bucket] == 1, (
            f"chunks={chunks} expected bucket '{expected_bucket}' to be 1, got {dist}"
        )

    def test_all_buckets_present_in_response(self, test_client: TestClient):
        """All 5 bucket keys must always be present in the response."""
        with patch("app.services.usage_service.UsageService.get_usage", return_value=MOCK_USAGE):
            resp = test_client.get("/analytics/overview")

        dist = resp.json()["chunk_distribution"]
        for key in ("0-50", "51-100", "101-200", "201-500", "500+"):
            assert key in dist, f"Missing bucket '{key}'"


# ---------------------------------------------------------------------------
# /analytics/overview — usage passthrough
# ---------------------------------------------------------------------------
class TestAnalyticsUsage:
    def test_usage_fields_passed_through(self, test_client: TestClient):
        """Usage data from UsageService must appear verbatim in the response."""
        mock_usage = {"used": 35, "limit": 50, "percentage": 70, "plan": "pro"}
        with patch("app.services.usage_service.UsageService.get_usage", return_value=mock_usage):
            resp = test_client.get("/analytics/overview")

        usage = resp.json()["usage"]
        assert usage["used"] == 35
        assert usage["limit"] == 50
        assert usage["percentage"] == 70
        assert usage["plan"] == "pro"

    def test_usage_service_failure_graceful(self, test_client: TestClient):
        """If UsageService raises, the endpoint must still return 200 with default usage."""
        with patch(
            "app.services.usage_service.UsageService.get_usage",
            side_effect=Exception("usage db unavailable"),
        ):
            resp = test_client.get("/analytics/overview")

        # Should not crash — graceful fallback
        assert resp.status_code == 200
        usage = resp.json().get("usage", {})
        assert "used" in usage


# ---------------------------------------------------------------------------
# /analytics/activity — empty state
# ---------------------------------------------------------------------------
class TestAnalyticsActivityEmpty:
    def test_empty_returns_empty_events(self, test_client: TestClient):
        """No documents → empty events list."""
        resp = test_client.get("/analytics/activity")

        assert resp.status_code == 200
        data = resp.json()
        assert data["events"] == []
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# /analytics/activity — event shape and content
# ---------------------------------------------------------------------------
class TestAnalyticsActivityEvents:
    REQUIRED_KEYS = {"type", "icon", "title", "description", "timestamp", "document_id"}

    def test_event_has_required_keys(self, test_client: TestClient, tmp_registry):
        """Each activity event must contain all required fields."""
        tmp_registry.upsert(_make_doc("d1", file_name="report.pdf", chunks=15, pages=3))

        resp = test_client.get("/analytics/activity")

        assert resp.status_code == 200
        events = resp.json()["events"]
        assert len(events) == 1
        assert self.REQUIRED_KEYS.issubset(events[0].keys())

    def test_event_type_is_document_uploaded(self, test_client: TestClient, tmp_registry):
        """Activity event type must be 'document_uploaded'."""
        tmp_registry.upsert(_make_doc("d1"))

        resp = test_client.get("/analytics/activity")
        assert resp.json()["events"][0]["type"] == "document_uploaded"

    def test_event_title_contains_filename(self, test_client: TestClient, tmp_registry):
        """Event title must include the document's file name."""
        tmp_registry.upsert(_make_doc("d1", file_name="my_thesis.pdf"))

        resp = test_client.get("/analytics/activity")
        assert "my_thesis.pdf" in resp.json()["events"][0]["title"]

    def test_event_description_contains_chunk_count(
        self, test_client: TestClient, tmp_registry
    ):
        """Event description must include the chunk count."""
        tmp_registry.upsert(_make_doc("d1", chunks=42))

        resp = test_client.get("/analytics/activity")
        assert "42" in resp.json()["events"][0]["description"]

    def test_total_matches_events_length(self, test_client: TestClient, tmp_registry):
        """total field must equal len(events)."""
        for i in range(4):
            tmp_registry.upsert(_make_doc(f"d{i}"))

        resp = test_client.get("/analytics/activity")
        data = resp.json()
        assert data["total"] == len(data["events"])


# ---------------------------------------------------------------------------
# /analytics/activity — ordering and limit
# ---------------------------------------------------------------------------
class TestAnalyticsActivityOrdering:
    def test_events_sorted_newest_first(self, test_client: TestClient, tmp_registry):
        """Events must be ordered by created_at descending (newest first)."""
        tmp_registry.upsert(_make_doc("d1", days_ago=10))
        tmp_registry.upsert(_make_doc("d2", days_ago=2))
        tmp_registry.upsert(_make_doc("d3", days_ago=5))

        resp = test_client.get("/analytics/activity")
        events = resp.json()["events"]
        timestamps = [e["timestamp"] for e in events]
        assert timestamps == sorted(timestamps, reverse=True), (
            "Events not sorted newest-first"
        )

    def test_default_limit_is_20(self, test_client: TestClient, tmp_registry):
        """Default endpoint should return at most 20 events."""
        for i in range(25):
            tmp_registry.upsert(_make_doc(f"d{i}"))

        resp = test_client.get("/analytics/activity")
        assert len(resp.json()["events"]) <= 20

    def test_custom_limit_respected(self, test_client: TestClient, tmp_registry):
        """?limit=5 must return at most 5 events."""
        for i in range(10):
            tmp_registry.upsert(_make_doc(f"d{i}"))

        resp = test_client.get("/analytics/activity?limit=5")
        assert len(resp.json()["events"]) <= 5

    def test_limit_zero_returns_empty(self, test_client: TestClient, tmp_registry):
        """?limit=0 must return an empty events list."""
        tmp_registry.upsert(_make_doc("d1"))

        resp = test_client.get("/analytics/activity?limit=0")
        assert resp.status_code == 200
        assert resp.json()["events"] == []


# ---------------------------------------------------------------------------
# Auth guard (requires AUTH_ENABLED=true)
# ---------------------------------------------------------------------------
class TestAnalyticsAuthGuard:
    def test_overview_requires_auth_when_enabled(self, tmp_registry, mock_vector_store):
        """When AUTH_ENABLED=true, unauthenticated requests must return 401."""
        os.environ["AUTH_ENABLED"] = "true"
        try:
            from app.config import get_settings

            get_settings.cache_clear()

            from app.dependencies import get_registry, set_embeddings, set_vector_store
            from app.main import app

            set_vector_store(mock_vector_store)
            set_embeddings(MagicMock())

            def override_registry():
                return tmp_registry

            app.dependency_overrides[get_registry] = override_registry
            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get("/analytics/overview")
            assert resp.status_code == 401

        finally:
            os.environ["AUTH_ENABLED"] = "false"
            from app.config import get_settings

            get_settings.cache_clear()
            app.dependency_overrides.clear()
            set_vector_store(None)
            set_embeddings(None)

    def test_activity_requires_auth_when_enabled(self, tmp_registry, mock_vector_store):
        """When AUTH_ENABLED=true, unauthenticated /activity requests must return 401."""
        os.environ["AUTH_ENABLED"] = "true"
        try:
            from app.config import get_settings

            get_settings.cache_clear()

            from app.dependencies import get_registry, set_embeddings, set_vector_store
            from app.main import app

            set_vector_store(mock_vector_store)
            set_embeddings(MagicMock())
            app.dependency_overrides[get_registry] = lambda: tmp_registry
            client = TestClient(app, raise_server_exceptions=False)

            resp = client.get("/analytics/activity")
            assert resp.status_code == 401

        finally:
            os.environ["AUTH_ENABLED"] = "false"
            from app.config import get_settings

            get_settings.cache_clear()
            app.dependency_overrides.clear()
            set_vector_store(None)
            set_embeddings(None)
