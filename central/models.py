from db import Base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    DateTime,
    Date,
    ForeignKey,
    UniqueConstraint,
)
from datetime import datetime

class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True)
  name = Column(String, nullable=True)
  email = Column(String, unique=True)
  password_hash = Column(String)
  email_verified = Column(Boolean, default=False)
  verify_token = Column(String, nullable=True)
  reset_token = Column(String, nullable=True)

class Page(Base):
    __tablename__ = "pages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, default="")
    result_json = Column(Text)
    source = Column(String, nullable=False, default="user")
    metadata_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=True)
    language = Column(String, nullable=False)

class Notebook(Base):
    __tablename__ = "notebooks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    created_at = Column(DateTime)

class UserLemma(Base):
    __tablename__ = "user_lemmas"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    lemma_key = Column(String, index=True)
    exposure_count = Column(Integer, nullable=False, default=0)
    is_known = Column(Boolean, nullable=False, default=False)
    is_interested = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("user_id", "lemma_key"),
    )

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    page_id = Column(Integer, ForeignKey("pages.id"), index=True)

    type = Column(String)  # "link" | "memo"
    content = Column(Text)

    start_index = Column(Integer)
    end_index = Column(Integer)

    created_at = Column(DateTime)
