from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    # JSON array of permission strings e.g. ["dashboard","scanner","projects","tools","profile"]
    permissions = Column(Text, default='[]')
    is_default = Column(Boolean, default=False)   # auto-assigned to new registrations
    is_system = Column(Boolean, default=False)    # cannot be deleted
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="group")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String, nullable=False)
    # is_active=True → can log in; False → pending approval or disabled
    is_active = Column(Boolean, default=True)
    # is_approved=True → admin has reviewed registration; default True for backward compat
    is_approved = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)     # legacy field, kept for compatibility
    activation_token = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    group = relationship("Group", back_populates="users")

    projects = relationship("Project", back_populates="owner")
    scan_jobs = relationship("ScanJob", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    nodes = Column(Text, default="[]")
    edges = Column(Text, default="[]")
    settings = Column(Text, default="{}")
    thumbnail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="projects")


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    ip_range = Column(String, nullable=False)
    status = Column(String, default="pending")   # pending | running | completed | failed
    progress = Column(Integer, default=0)
    results = Column(Text, default="[]")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="scan_jobs")


class AppConfig(Base):
    __tablename__ = "app_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
