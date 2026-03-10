from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
import re


# ---------------------------------------------------------------------------
# Auth / Users
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be between 3 and 50 characters")
        if not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, and hyphens")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password is too long")
        return v


class UserRegister(BaseModel):
    """Public self-registration — no admin required."""
    username: str
    password: str
    email: str
    full_name: Optional[str] = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be between 3 and 50 characters")
        if not re.match(r'^[a-zA-Z0-9_.-]+$', v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, and hyphens")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password is too long")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    is_approved: bool = True
    is_admin: bool
    created_at: datetime
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    permissions: List[str] = []


class UserUpdateAdmin(BaseModel):
    """Admin-level user update."""
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_approved: Optional[bool] = None
    is_admin: Optional[bool] = None
    group_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Group name must be between 2 and 100 characters")
        return v


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    is_default: bool
    is_system: bool
    created_at: datetime
    user_count: int = 0


# ---------------------------------------------------------------------------
# App Configuration
# ---------------------------------------------------------------------------

class ConfigEntry(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None


class ConfigUpdate(BaseModel):
    entries: List[ConfigEntry]


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[str] = None
    edges: Optional[str] = None
    settings: Optional[str] = None
    thumbnail: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    nodes: str
    edges: str
    settings: str
    thumbnail: Optional[str]
    created_at: datetime
    updated_at: datetime
    owner_id: int


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    ip_range: str
    scan_type: str = "basic"       # basic | nmap
    run_topology: bool = False
    snmp_communities: Optional[List[str]] = None
    use_traceroute: bool = True
    use_nmap_lldp: bool = True


class TopologyRequest(BaseModel):
    devices: List[Any]
    snmp_communities: Optional[List[str]] = None
    use_traceroute: bool = True
    use_nmap_lldp: bool = True


class ScanJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_range: str
    status: str
    progress: int
    results: str
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]


# ---------------------------------------------------------------------------
# Network Tools
# ---------------------------------------------------------------------------

class PingRequest(BaseModel):
    host: str
    count: int = 4


class TracerouteRequest(BaseModel):
    host: str


class DNSRequest(BaseModel):
    host: str


class PortScanRequest(BaseModel):
    host: str
    ports: Optional[str] = "1-1024"
