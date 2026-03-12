from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, Text, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

from config import DB_URL

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)      # Argon2id hash
    kdf_salt = Column(Text, nullable=False)            # separate salt for key derivation
    failed_attempts = Column(Integer, default=0)
    lockout_until = Column(DateTime, nullable=True)
    totp_secret = Column(Text, nullable=True)          # base32, only if 2FA enabled

    credentials = relationship("Credential", back_populates="owner", cascade="all, delete-orphan")
    score_history = relationship("ScoreHistory", back_populates="owner", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="owner", cascade="all, delete-orphan")


def _migrate_add_columns():
    """Idempotent column additions for schema upgrades."""
    with engine.connect() as conn:
        from sqlalchemy import text
        for col_sql in [
            "ALTER TABLE credentials ADD COLUMN breach_count INTEGER DEFAULT 0",
            "ALTER TABLE credentials ADD COLUMN email_breached INTEGER DEFAULT 0",
            "ALTER TABLE credentials ADD COLUMN email_breach_count INTEGER DEFAULT 0",
        ]:
            try:
                conn.execute(text(col_sql))
                conn.commit()
            except Exception:
                pass  # column already exists


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    site_name = Column(Text, nullable=False)
    site_username = Column(Text, nullable=False)       # encrypted
    ciphertext = Column(Text, nullable=False)          # AES-256-GCM ciphertext, base64
    iv = Column(Text, nullable=False)                  # 96-bit nonce, base64
    tag = Column(Text, nullable=False)                 # GCM auth tag, base64
    reuse_hash = Column(Text, nullable=False)          # SHA-256 of plaintext password
    strength_label = Column(Text, nullable=False)      # weak / medium / strong
    is_breached = Column(Boolean, default=False)
    breach_count = Column(Integer, default=0)           # HIBP pwned count for password
    email_breached = Column(Boolean, default=False)    # HIBP email breach
    email_breach_count = Column(Integer, default=0)   # number of email breaches
    breach_date_status = Column(Text, nullable=True)   # changed_after / not_rotated
    is_stale = Column(Boolean, default=False)
    category = Column(Text, default="other")           # email/banking/social/work/other
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="credentials")
    history = relationship("PasswordHistory", back_populates="credential", cascade="all, delete-orphan")


class PasswordHistory(Base):
    __tablename__ = "password_history"

    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey("credentials.id"), nullable=False)
    ciphertext = Column(Text, nullable=False)
    iv = Column(Text, nullable=False)
    tag = Column(Text, nullable=False)
    reuse_hash = Column(Text, nullable=False)
    archived_at = Column(DateTime, default=datetime.utcnow)

    credential = relationship("Credential", back_populates="history")


class BreachCache(Base):
    __tablename__ = "breach_cache"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(Text, nullable=False, unique=True)
    result_json = Column(Text, nullable=False)         # JSON string of breach list
    cached_at = Column(DateTime, default=datetime.utcnow)


class ScoreHistory(Base):
    __tablename__ = "score_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="score_history")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Text, nullable=False)
    ip_address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="audit_logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()
