"""Custom exception classes for the Intelligent Knowledge Base API."""

from __future__ import annotations


class KnowledgeBaseError(Exception):
    """Base exception for all knowledge base errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class VectorStoreNotInitializedError(KnowledgeBaseError):
    """Raised when the vector store is not available."""

    def __init__(self, message: str = "Vector store not initialized.") -> None:
        super().__init__(message, status_code=503)


class DocumentNotFoundError(KnowledgeBaseError):
    """Raised when a requested document does not exist."""

    def __init__(self, document_id: str) -> None:
        super().__init__(f"Document not found: {document_id}", status_code=404)
        self.document_id = document_id


class UnsupportedFileTypeError(KnowledgeBaseError):
    """Raised when an uploaded file has an unsupported extension."""

    def __init__(self, extension: str) -> None:
        super().__init__(f"Unsupported file type: {extension}", status_code=400)
        self.extension = extension


class FileTooLargeError(KnowledgeBaseError):
    """Raised when an uploaded file exceeds the size limit."""

    def __init__(self, file_name: str, max_mb: int) -> None:
        super().__init__(f"File '{file_name}' exceeds max size of {max_mb} MB", status_code=413)


class EmptyDocumentError(KnowledgeBaseError):
    """Raised when a document is empty or unreadable."""

    def __init__(self, file_name: str) -> None:
        super().__init__(f"Document is empty or unreadable: {file_name}", status_code=400)


class NoFilesUploadedError(KnowledgeBaseError):
    """Raised when no files are included in an upload request."""

    def __init__(self) -> None:
        super().__init__("No files uploaded", status_code=400)


class StorageUnavailableError(KnowledgeBaseError):
    """Raised when the storage backend is unavailable."""

    def __init__(self, message: str = "Storage temporarily unavailable.") -> None:
        super().__init__(message, status_code=503)
