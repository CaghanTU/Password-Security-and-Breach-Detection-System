import re
from typing import Iterable

from sqlalchemy.orm import Session
from zxcvbn import zxcvbn

from database import Credential
from services.crypto_service import decrypt

_TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9]+")
_SIMPLE_WORD_DIGITS_RE = re.compile(r"^[A-Za-z]+(?:[._-]?[A-Za-z]+)*\d{1,4}[!@#$%^&*._-]?$")


def _decode_username(encoded: str, key: bytes) -> str:
    parts = encoded.split("|")
    if len(parts) == 3:
        return decrypt(parts[0], parts[1], parts[2], key)
    return encoded


def _context_tokens(*values: str) -> list[str]:
    tokens: list[str] = []
    seen: set[str] = set()

    for value in values:
        if not value:
            continue
        for part in _TOKEN_SPLIT_RE.split(value.lower()):
            if len(part) < 3 or part in seen:
                continue
            seen.add(part)
            tokens.append(part)

    return tokens


def _character_class_count(password: str) -> int:
    return sum(
        (
            any(ch.islower() for ch in password),
            any(ch.isupper() for ch in password),
            any(ch.isdigit() for ch in password),
            any(not ch.isalnum() for ch in password),
        )
    )


def calculate_strength_label(
    password: str,
    site_name: str = "",
    site_username: str = "",
) -> str:
    password = password or ""
    if not password:
        return "weak"

    context_tokens = _context_tokens(site_name or "", site_username or "")
    score = zxcvbn(password, user_inputs=context_tokens)["score"]
    password_lower = password.lower()
    length = len(password)
    class_count = _character_class_count(password)
    contains_context = any(token in password_lower for token in context_tokens)
    simple_word_digits = bool(_SIMPLE_WORD_DIGITS_RE.fullmatch(password))

    if score <= 1 or length < 8 or contains_context:
        return "weak"

    # Short "word + 123" style passwords should never surface as strong.
    if simple_word_digits and length < 12:
        return "weak"

    if score == 2:
        return "medium"

    # Long high-entropy passphrases can still be strong even with fewer char classes.
    if score >= 4 and length >= 14:
        return "strong"

    if length < 12:
        return "medium"

    if class_count < 3 and score < 4:
        return "medium"

    return "strong" if score >= 3 else "medium"


def sync_credential_strength_labels(
    db: Session,
    credentials: Iterable[Credential],
    key: bytes,
) -> bool:
    touched = False

    for cred in credentials:
        try:
            password = decrypt(cred.ciphertext, cred.iv, cred.tag, key)
            username = _decode_username(cred.site_username, key)
        except Exception:
            continue

        fresh_label = calculate_strength_label(password, cred.site_name, username)
        if cred.strength_label != fresh_label:
            cred.strength_label = fresh_label
            touched = True

    if touched:
        db.commit()

    return touched
