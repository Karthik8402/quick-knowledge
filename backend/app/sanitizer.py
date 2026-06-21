"""Context sanitizer to detect and mitigate indirect prompt injection.

Indirect prompt injection occurs when retrieved document content contains
imperative instructions that override the system prompt (e.g. "ignore previous
instructions"). This module detects common patterns and sanitises them before
the context reaches the LLM.
"""

from __future__ import annotations

import logging
import re

from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class ContextSanitizer:
    """Scans retrieved chunks for imperative/injection patterns and sanitises them.

    Usage::

        sanitised = ContextSanitizer.sanitise_docs(retrieved_docs)
        # or scan without modifying:
        result = ContextSanitizer.scan_chunk(text)
        if result["flagged"]:
            ...
    """

    _COMMAND_PATTERNS: list[re.Pattern] = [
        # "ignore all previous instructions" family
        re.compile(r"ignore\s+(all\s+)?previous\s+instructions?", re.IGNORECASE),
        re.compile(r"disregard\s+(all\s+)?(previous|prior)", re.IGNORECASE),
        re.compile(r"forget\s+(all\s+)?(previous|prior|earlier)", re.IGNORECASE),
        # Role-play / persona hijacking
        re.compile(r"you\s+are\s+(now\s+)?(a|an|not\s+a)", re.IGNORECASE),
        re.compile(r"act\s+as\s+(?:a|an)\s+", re.IGNORECASE),
        # Instruction override
        re.compile(r"(new|override|updated?)\s+instructions?\s*:?", re.IGNORECASE),
        re.compile(r"system\s*:\s*(prompt|message|instruction)", re.IGNORECASE),
        # Special tokens used in chat templates
        re.compile(r"<\|?(system|im_start|im_end|endoftext|assistant|user)\|?>", re.IGNORECASE),
        # Strong directives
        re.compile(r"you\s+(must|will|shall|should|need\s+to)\s+", re.IGNORECASE),
        re.compile(r"do\s+not\s+(mention|say|tell|reveal|include)", re.IGNORECASE),
        # Unicode fullwidth Latin homoglyph attack vector (e.g. ｉｇｎｏｒｅ)
        re.compile(r"[\uff41-\uff5a\uff21-\uff3a]"),
    ]

    # ------------------------------------------------------------------
    # Scanning
    # ------------------------------------------------------------------
    @classmethod
    def scan_chunk(cls, text: str) -> dict:
        """Return scan results for a single text chunk.

        Returns ``{"flagged": bool, "matches": list[dict]}`` where each
        match dict contains ``pattern``, ``matched``, ``start``, ``end``.
        """
        results: list[dict] = []
        for pattern in cls._COMMAND_PATTERNS:
            for m in pattern.finditer(text):
                results.append(
                    {
                        "pattern": pattern.pattern[:60],
                        "matched": m.group()[:80],
                        "start": m.start(),
                        "end": m.end(),
                    }
                )
        return {"flagged": bool(results), "matches": results}

    # ------------------------------------------------------------------
    # Sanitisation (destructive — replaces matched text)
    # ------------------------------------------------------------------
    @classmethod
    def sanitise_text(cls, text: str, placeholder: str = "[SANITISED]") -> str:
        """Replace all detected injection patterns with *placeholder*."""
        result = text
        for pattern in cls._COMMAND_PATTERNS:
            result = pattern.sub(placeholder, result)
        return result

    @classmethod
    def sanitise_docs(
        cls,
        docs: list[tuple[Document, float]],
        _logger: logging.Logger | None = None,
    ) -> list[tuple[Document, float]]:
        """Sanitise retrieved documents **in place** and return them.

        Logs a warning for every chunk that contains injection patterns.
        """
        log = _logger or logger
        flagged = 0
        for doc, score in docs:
            scan = cls.scan_chunk(doc.page_content or "")
            if scan["flagged"]:
                flagged += 1
                log.warning(
                    "Indirect prompt injection detected in chunk (relevance=%.3f): %d match(es)",
                    score,
                    len(scan["matches"]),
                )
                doc.page_content = cls.sanitise_text(doc.page_content)
        if flagged:
            log.info("ContextSanitizer: sanitised %d/%d chunks", flagged, len(docs))
        return docs
