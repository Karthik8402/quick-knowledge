from __future__ import annotations


def score_to_confidence(score: float | None) -> str:
    """Map a relevance score to a confidence label.

    Thresholds (assuming similarity scores where higher = better):
        score >= 0.70  → ``"High"``
        score >= 0.45  → ``"Medium"``
        otherwise      → ``"Low"``
    """
    if score is None:
        return "Low"
    if score >= 0.70:
        return "High"
    if score >= 0.45:
        return "Medium"
    return "Low"


def validate_citation_indices(citation_indices: list[int], total_sources: int) -> list[int]:
    valid = []
    seen = set()
    for idx in citation_indices:
        try:
            val = int(idx)
        except (ValueError, TypeError):
            continue
        if val < 1 or val > total_sources:
            continue
        if val in seen:
            continue
        seen.add(val)
        valid.append(val)

    return valid
