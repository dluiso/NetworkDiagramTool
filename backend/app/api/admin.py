"""
Admin API — full access requires 'admin' permission.
Endpoints: users, groups, configuration, stats.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import json

from ..database import get_db
from ..models import User, Group, AppConfig
from ..schemas import (
    UserResponse, UserUpdateAdmin,
    GroupCreate, GroupUpdate, GroupResponse,
    ConfigEntry, ConfigUpdate,
)
from ..core.security import (
    get_password_hash, user_has_permission, get_user_permissions,
    ALL_PERMISSIONS,
)
from ..core.email import send_account_approved_email, send_account_deactivated_email
from .auth import get_current_user, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_response(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_approved": user.is_approved,
        "is_admin": user.is_admin,
        "created_at": user.created_at,
        "group_id": user.group_id,
        "group_name": user.group.name if user.group else None,
        "permissions": get_user_permissions(user),
    }


def _build_group_response(group: Group) -> dict:
    try:
        perms = json.loads(group.permissions or "[]")
    except (ValueError, TypeError):
        perms = []
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "permissions": perms,
        "is_default": group.is_default,
        "is_system": group.is_system,
        "created_at": group.created_at,
        "user_count": len(group.users),
    }


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    total_users = db.query(User).count()
    pending = db.query(User).filter(User.is_approved == False).count()
    active = db.query(User).filter(User.is_active == True, User.is_approved == True).count()
    inactive = db.query(User).filter(User.is_active == False, User.is_approved == True).count()
    total_groups = db.query(Group).count()

    return {
        "total_users": total_users,
        "pending_approval": pending,
        "active_users": active,
        "inactive_users": inactive,
        "total_groups": total_groups,
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    status_filter: Optional[str] = None,  # pending | active | inactive | all
):
    q = db.query(User).options(selectinload(User.group))

    if status_filter == "pending":
        q = q.filter(User.is_approved == False)
    elif status_filter == "active":
        q = q.filter(User.is_active == True, User.is_approved == True)
    elif status_filter == "inactive":
        q = q.filter(User.is_active == False, User.is_approved == True)

    users = q.order_by(User.created_at.desc()).all()
    return [_build_user_response(u) for u in users]


@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_user_response(user)


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    data: UserUpdateAdmin,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-demotion from admin
    if user.id == current_admin.id and data.is_admin is False:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin status")

    track_approved = data.is_approved
    track_deactivated = None

    for field, value in data.model_dump(exclude_unset=True).items():
        # When approving, also activate
        if field == "is_approved" and value is True:
            user.is_approved = True
            user.is_active = True
        elif field == "is_active" and value is False:
            track_deactivated = True
            user.is_active = False
        else:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)

    # Send email notifications
    if track_approved and user.email:
        send_account_approved_email(user.email, user.username)
    if track_deactivated and user.email:
        send_account_deactivated_email(user.email, user.username)

    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    return _build_user_response(user)


@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")

    user.is_approved = True
    user.is_active = True
    db.commit()

    if user.email:
        send_account_approved_email(user.email, user.username)

    db.refresh(user)
    return _build_user_response(user)


@router.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()

    if user.email:
        send_account_deactivated_email(user.email, user.username)

    db.refresh(user)
    return _build_user_response(user)


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).options(selectinload(User.group)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    user.is_approved = True
    db.commit()
    db.refresh(user)
    return _build_user_response(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()


@router.put("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
    return {"message": "Password reset successfully"}


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------

@router.get("/groups")
async def list_groups(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    groups = db.query(Group).options(selectinload(Group.users)).order_by(Group.name).all()
    return [_build_group_response(g) for g in groups]


@router.get("/groups/{group_id}")
async def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = db.query(Group).options(selectinload(Group.users)).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return _build_group_response(group)


@router.post("/groups", status_code=201)
async def create_group(
    data: GroupCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if db.query(Group).filter(Group.name == data.name).first():
        raise HTTPException(status_code=400, detail="A group with this name already exists")

    # Validate permissions
    valid_perms = [p for p in data.permissions if p in ALL_PERMISSIONS]

    group = Group(
        name=data.name,
        description=data.description,
        permissions=json.dumps(valid_perms),
        is_system=False,
        is_default=False,
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    group = db.query(Group).options(selectinload(Group.users)).filter(Group.id == group.id).first()
    return _build_group_response(group)


@router.put("/groups/{group_id}")
async def update_group(
    group_id: int,
    data: GroupUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = db.query(Group).options(selectinload(Group.users)).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if data.name is not None:
        if group.is_system:
            raise HTTPException(status_code=400, detail="System groups cannot be renamed")
        existing = db.query(Group).filter(Group.name == data.name, Group.id != group_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A group with this name already exists")
        group.name = data.name

    if data.description is not None:
        group.description = data.description

    if data.permissions is not None:
        valid_perms = [p for p in data.permissions if p in ALL_PERMISSIONS]
        group.permissions = json.dumps(valid_perms)

    db.commit()
    db.refresh(group)

    group = db.query(Group).options(selectinload(Group.users)).filter(Group.id == group_id).first()
    return _build_group_response(group)


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = db.query(Group).options(selectinload(Group.users)).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.is_system:
        raise HTTPException(status_code=400, detail="System groups cannot be deleted")
    if group.users:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete group with {len(group.users)} member(s). Reassign users first.",
        )
    db.delete(group)
    db.commit()


@router.post("/groups/{group_id}/set-default")
async def set_default_group(
    group_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Clear previous default
    db.query(Group).filter(Group.is_default == True).update({"is_default": False})
    group.is_default = True
    db.commit()
    return {"message": f"'{group.name}' is now the default group for new registrations"}


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "app_name": ("NetDiagram", "Application display name"),
    "registration_enabled": ("true", "Allow public self-registration"),
    "session_timeout_minutes": ("480", "JWT token lifetime in minutes"),
    "smtp_host": ("", "SMTP server hostname"),
    "smtp_port": ("587", "SMTP server port"),
    "smtp_user": ("", "SMTP username"),
    "smtp_password": ("", "SMTP password"),
    "smtp_from": ("noreply@netdiagram.local", "Sender email address"),
    "smtp_tls": ("true", "Use STARTTLS for SMTP"),
    "frontend_url": ("http://localhost:5173", "Frontend URL for links in emails"),
}


@router.get("/config")
async def get_config(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    configs = {c.key: c for c in db.query(AppConfig).all()}
    result = []
    for key, (default_val, description) in DEFAULT_CONFIG.items():
        entry = configs.get(key)
        # Mask password fields
        value = entry.value if entry else default_val
        if "password" in key and value:
            value = "••••••••"
        result.append({
            "key": key,
            "value": value,
            "description": description,
        })
    return result


@router.put("/config")
async def update_config(
    data: ConfigUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    for entry in data.entries:
        if entry.key not in DEFAULT_CONFIG:
            continue
        # Don't overwrite password if masked value submitted
        if "password" in entry.key and entry.value and "••" in entry.value:
            continue

        existing = db.query(AppConfig).filter(AppConfig.key == entry.key).first()
        if existing:
            existing.value = entry.value
        else:
            _, description = DEFAULT_CONFIG[entry.key]
            db.add(AppConfig(key=entry.key, value=entry.value, description=description))

    db.commit()
    return {"message": "Configuration saved"}


@router.get("/permissions/available")
async def get_available_permissions(_: User = Depends(require_admin)):
    """Return all available permission slugs with descriptions."""
    descriptions = {
        "dashboard": "Access dashboard",
        "scanner": "Use Network Scanner",
        "projects": "Manage diagram projects",
        "tools": "Use network tools (ping, traceroute, etc.)",
        "profile": "View and edit own profile",
        "admin": "Full admin panel access (grants all other permissions)",
        "users": "Manage users",
        "groups": "Manage groups",
        "config": "Manage application configuration",
    }
    return [{"slug": p, "description": descriptions.get(p, p)} for p in ALL_PERMISSIONS]
