import base64
import hashlib
import os

from argon2 import PasswordHasher
from argon2.low_level import Type, hash_secret_raw
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Argon2id hasher for authentication (stores a verifiable hash)
_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


def hash_password(master_password: str) -> str:
    """Hash master_password with Argon2id for authentication storage."""
    return _ph.hash(master_password)


def verify_password(stored_hash: str, master_password: str) -> bool:
    """Verify master_password against Argon2id stored hash."""
    try:
        return _ph.verify(stored_hash, master_password)
    except Exception:
        return False


def generate_kdf_salt() -> str:
    """Generate a random 16-byte salt for key derivation, returned as hex."""
    return os.urandom(16).hex()


def derive_key(master_password: str, kdf_salt: str) -> bytes:
    """
    Derive a 32-byte AES-256 key from master_password using Argon2id.
    kdf_salt is a hex string.  The derived key is NEVER stored.
    """
    salt_bytes = bytes.fromhex(kdf_salt)
    key = hash_secret_raw(
        secret=master_password.encode("utf-8"),
        salt=salt_bytes,
        time_cost=3,
        memory_cost=65536,
        parallelism=4,
        hash_len=32,
        type=Type.ID,
    )
    return key


def encrypt(plaintext: str, key: bytes) -> tuple[str, str, str]:
    """
    Encrypt plaintext using AES-256-GCM.

    Returns (ciphertext_b64, iv_b64, tag_b64).
    The GCM authentication tag is stored separately for pedagogical clarity.
    """
    iv = os.urandom(12)          # 96-bit nonce recommended for GCM
    aesgcm = AESGCM(key)
    # cryptography library appends the 16-byte tag to ciphertext
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    ciphertext = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]

    return (
        base64.b64encode(ciphertext).decode("ascii"),
        base64.b64encode(iv).decode("ascii"),
        base64.b64encode(tag).decode("ascii"),
    )


def decrypt(ciphertext_b64: str, iv_b64: str, tag_b64: str, key: bytes) -> str:
    """
    Decrypt AES-256-GCM ciphertext.  GCM tag is verified during decryption;
    raises an exception on tampering.
    """
    ciphertext = base64.b64decode(ciphertext_b64)
    iv = base64.b64decode(iv_b64)
    tag = base64.b64decode(tag_b64)

    aesgcm = AESGCM(key)
    plaintext_bytes = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext_bytes.decode("utf-8")


def hash_for_reuse(password: str) -> str:
    """
    SHA-256 hash of the plaintext password for same-user reuse detection.
    Only used for comparison within the same user's vault — never cross-user.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def normalize_lookup_value(value: str) -> str:
    """Normalize usernames/emails for stable lookups without storing plaintext."""
    return (value or "").strip().lower()


def hash_lookup_value(value: str) -> str:
    normalized = normalize_lookup_value(value)
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def normalize_recovery_code(code: str) -> str:
    """Accept user-entered recovery codes with spaces/dashes and normalize them."""
    return "".join(ch for ch in (code or "").upper() if ch.isalnum())
