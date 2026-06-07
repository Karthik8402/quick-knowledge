"""Tests for the generation module — covers context building, message construction, response parsing, and streaming."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tests.conftest import make_document


class TestBuildContext:
    def test_build_context_single_doc(self):
        from app.generation import build_context

        doc = make_document(text="hello world", document_id="d1", file_name="a.pdf", page=0)
        result = build_context([(doc, 0.9)])
        assert "Reference 1" in result
        assert "hello world" in result
        assert "a.pdf" in result

    def test_build_context_multiple_docs(self):
        from app.generation import build_context

        docs = [
            (make_document(text="first", document_id="d1"), 0.9),
            (make_document(text="second", document_id="d2"), 0.8),
        ]
        result = build_context(docs)
        assert "Reference 1" in result
        assert "Reference 2" in result
        assert "first" in result
        assert "second" in result

    def test_build_context_no_page(self):
        from app.generation import build_context

        doc = make_document(text="text", page=None)
        result = build_context([(doc, 0.5)])
        assert "Page:" not in result


class TestParseResponse:
    def test_parse_extracts_inline_citations(self):
        """Inline [Source N] references are extracted as citation_indices."""
        from app.generation import _parse_llm_response

        text = "The model was trained on ImageNet [Source 1] and refined with RLHF [Source 2]."
        result = _parse_llm_response(text)
        assert result["answer"] == text
        assert 1 in result["citation_indices"]
        assert 2 in result["citation_indices"]

    def test_parse_no_citations_returns_empty_list(self):
        from app.generation import _parse_llm_response

        result = _parse_llm_response("This is a plain answer with no citations.")
        assert result["answer"] == "This is a plain answer with no citations."
        assert result["citation_indices"] == []

    def test_parse_deduplicates_citation_indices(self):
        """Duplicate [Source N] mentions should only appear once."""
        from app.generation import _parse_llm_response

        text = "See [Source 1]. Also [Source 1] confirms this."
        result = _parse_llm_response(text)
        assert result["citation_indices"].count(1) == 1

    def test_parse_empty_string_returns_fallback(self):
        from app.generation import FALLBACK_ANSWER, _parse_llm_response

        result = _parse_llm_response("")
        assert result["answer"] == FALLBACK_ANSWER
        assert result["citation_indices"] == []

    def test_parse_case_insensitive_source_tag(self):
        from app.generation import _parse_llm_response

        result = _parse_llm_response("Answer from [source 3] and [SOURCE 4].")
        assert 3 in result["citation_indices"]
        assert 4 in result["citation_indices"]


class TestBuildMessages:
    def test_build_messages_standard_provider(self):
        from app.generation import _build_messages

        with patch("app.generation.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(llm_provider="openai", llm_model="gpt-4")
            messages = _build_messages("What is AI?", "context here")
            assert len(messages) == 2  # SystemMessage + HumanMessage

    def test_build_messages_gemma_uses_single_prompt(self):
        from app.generation import _build_messages

        with patch("app.generation.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                llm_provider="google", llm_model="gemma-3-27b-it"
            )
            messages = _build_messages("What is AI?", "context here")
            assert len(messages) == 1  # Single HumanMessage for Gemma


class TestAnswerWithCitations:
    def test_empty_docs_returns_fallback(self):
        from app.generation import FALLBACK_ANSWER, answer_with_citations

        result = answer_with_citations("test", [])
        assert result["answer"] == FALLBACK_ANSWER
        assert result["citation_indices"] == []

    @patch("app.generation.get_chat_model")
    def test_llm_exception_returns_fallback(self, mock_get_model):
        from app.generation import FALLBACK_ANSWER, answer_with_citations

        mock_model = MagicMock()
        mock_model.invoke.side_effect = Exception("API error")
        mock_get_model.return_value = mock_model

        docs = [(make_document(), 0.9)]
        result = answer_with_citations("question", docs)
        assert result["answer"] == FALLBACK_ANSWER

    @patch("app.generation.get_chat_model")
    def test_valid_llm_response(self, mock_get_model):
        """LLM returns plain text with inline [Source N] — parsed correctly."""
        from app.generation import answer_with_citations

        mock_response = MagicMock()
        mock_response.content = "Test answer [Source 1]"
        mock_model = MagicMock()
        mock_model.invoke.return_value = mock_response
        mock_get_model.return_value = mock_model

        docs = [(make_document(), 0.9)]
        result = answer_with_citations("question", docs)
        assert result["answer"] == "Test answer [Source 1]"
        assert 1 in result["citation_indices"]


class TestStreamAnswerWithCitations:
    def test_stream_empty_docs_returns_fallback(self):
        from app.generation import FALLBACK_ANSWER, stream_answer_with_citations

        result = stream_answer_with_citations("test", [])
        # StreamResult exposes .tokens (generator) and .get_citations() callable
        tokens = list(result.tokens)
        assert tokens == [FALLBACK_ANSWER]
        # get_citations() should return empty list for fallback
        assert result.get_citations() == []

    @patch("app.generation.get_chat_model")
    def test_stream_yields_tokens(self, mock_get_model):
        from app.generation import stream_answer_with_citations

        # Mock the streaming response
        mock_chunk1 = MagicMock()
        mock_chunk1.content = "Test answer"
        mock_chunk2 = MagicMock()
        mock_chunk2.content = " [Source 1]"
        mock_chunk3 = MagicMock()
        mock_chunk3.content = " more content"

        mock_model = MagicMock()
        mock_model.stream.return_value = [mock_chunk1, mock_chunk2, mock_chunk3]
        mock_get_model.return_value = mock_model

        docs = [(make_document(), 0.9)]
        result = stream_answer_with_citations("question", docs)

        # IMPORTANT: consume tokens FIRST, then call get_citations()
        tokens = list(result.tokens)
        assert len(tokens) == 3
        assert "Test answer" in tokens[0]

        # After consuming tokens, citations can be resolved
        citations = result.get_citations()
        assert 1 in citations  # [Source 1] should be parsed


class TestGetSystemPrompt:
    def test_system_prompt_instructs_inline_citations(self):
        from app.generation import _get_system_prompt

        prompt = _get_system_prompt()
        # Current prompt uses inline [Source N] citation style
        assert "Source" in prompt or "citation" in prompt.lower()
        assert "context" in prompt.lower()

    def test_system_prompt_mentions_fallback_phrase(self):
        from app.generation import FALLBACK_ANSWER, _get_system_prompt

        prompt = _get_system_prompt()
        # Prompt should instruct LLM to use the exact fallback phrase
        assert "do not contain" in prompt.lower() or FALLBACK_ANSWER[:20] in prompt
