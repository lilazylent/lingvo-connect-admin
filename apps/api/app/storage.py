from __future__ import annotations

import hashlib
import os
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

SAFE_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".rtf": "application/rtf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


@dataclass
class StoredFile:
    storage_key: str
    original_name: str
    mime_type: str
    size_bytes: int
    sha256: str


class UnsafeFileError(ValueError):
    pass


class LocalApplicationStorage:
    def __init__(self, root: str, max_bytes: int):
        self.root = Path(root).resolve()
        self.max_bytes = max_bytes
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, application_id: str, original_name: str, stream: BinaryIO) -> StoredFile:
        safe_name = Path(original_name or "file").name
        extension = Path(safe_name).suffix.lower()
        if extension not in SAFE_TYPES:
            raise UnsafeFileError("Этот тип файла не поддерживается")

        directory = (self.root / application_id).resolve()
        if self.root not in directory.parents:
            raise UnsafeFileError("Недопустимый путь файла")
        directory.mkdir(parents=True, exist_ok=True)
        generated = f"{uuid.uuid4().hex}{extension}"
        target = directory / generated
        digest = hashlib.sha256()
        size = 0
        try:
            with target.open("xb") as destination:
                while chunk := stream.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise UnsafeFileError("Файл превышает допустимый размер")
                    digest.update(chunk)
                    destination.write(chunk)
            if size == 0:
                raise UnsafeFileError("Пустой файл нельзя загрузить")
            self._validate_signature(target, extension)
        except Exception:
            target.unlink(missing_ok=True)
            raise

        return StoredFile(
            storage_key=f"{application_id}/{generated}",
            original_name=safe_name[:255],
            mime_type=SAFE_TYPES[extension],
            size_bytes=size,
            sha256=digest.hexdigest(),
        )

    def resolve(self, storage_key: str) -> Path:
        path = (self.root / storage_key).resolve()
        if path != self.root and self.root not in path.parents:
            raise UnsafeFileError("Недопустимый путь файла")
        return path

    def delete(self, storage_key: str) -> None:
        path = self.resolve(storage_key)
        path.unlink(missing_ok=True)
        try:
            path.parent.rmdir()
        except OSError:
            pass

    @staticmethod
    def _validate_signature(path: Path, extension: str) -> None:
        head = path.read_bytes()[:16]
        if extension == ".pdf" and not head.startswith(b"%PDF-"):
            raise UnsafeFileError("Содержимое файла не соответствует PDF")
        if extension == ".png" and not head.startswith(b"\x89PNG\r\n\x1a\n"):
            raise UnsafeFileError("Содержимое файла не соответствует PNG")
        if extension in {".jpg", ".jpeg"} and not head.startswith(b"\xff\xd8\xff"):
            raise UnsafeFileError("Содержимое файла не соответствует JPEG")
        if extension == ".rtf" and not head.startswith(b"{\\rtf"):
            raise UnsafeFileError("Содержимое файла не соответствует RTF")
        if extension == ".txt":
            try:
                path.read_text(encoding="utf-8")
            except UnicodeDecodeError as error:
                raise UnsafeFileError("Текстовый файл должен быть в UTF-8") from error
        if extension in {".docx", ".xlsx", ".pptx"}:
            expected = {".docx": "word/", ".xlsx": "xl/", ".pptx": "ppt/"}[extension]
            try:
                with zipfile.ZipFile(path) as archive:
                    names = archive.namelist()
                    if "[Content_Types].xml" not in names or not any(
                        name.startswith(expected) for name in names
                    ):
                        raise UnsafeFileError("Содержимое офисного файла не соответствует формату")
            except zipfile.BadZipFile as error:
                raise UnsafeFileError("Повреждённый офисный файл") from error


def storage_from_settings(root: str, max_bytes: int) -> LocalApplicationStorage:
    return LocalApplicationStorage(os.path.abspath(root), max_bytes)
