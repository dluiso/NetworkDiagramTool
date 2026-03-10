from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, selectinload
from datetime import timedelta
from typing import Optional
import json

from ..database import get_db
from ..models import User, Group
from ..schemas import Token, UserCreate, UserRegister, UserResponse, ChangePasswordRequest
from ..core.security import (
    verify_password, get_password_hash, create_access_token, decode_access_token,
    user_has_permission, get_user_permissions, check_rate_limit, clear_rate_limit,
)
from ..core.email import send_registration_pending_email
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_user_response(user: User) -> dict:
    """Build a serializable dict with computed group/permissions fields."""
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


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return (
        db.query(User)
        .options(selectinload(User.group))
        .filter(User.username == username)
        .first()
    )


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# ---------------------------------------------------------------------------
# Dependency: get authenticated + active user
# ---------------------------------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if not username:
        raise credentials_exception

    user = get_user_by_username(db, username)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or pending approval",
        )
    return user


# ---------------------------------------------------------------------------
# Dependency factory: require a specific permission
# ---------------------------------------------------------------------------

def require_permission(permission: str):
    """Dependency factory — raises 403 if user lacks the given permission."""
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user
    return _check


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Shortcut dependency: require admin permission."""
    if not user_has_permission(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required",
        )
    return current_user


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{client_ip}"

    if not check_rate_limit(rate_key, settings.login_rate_limit, settings.login_rate_window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait before trying again.",
        )

    user = authenticate_user(db, form_data.username.strip().lower(), form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending administrator approval",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Contact your administrator.",
        )

    clear_rate_limit(rate_key)

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return _build_user_response(current_user)


# ---------------------------------------------------------------------------
# POST /auth/register  (public self-registration)
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_public(
    request: Request,
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"register:{client_ip}"

    if not check_rate_limit(rate_key, settings.register_rate_limit, settings.register_rate_window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please wait before trying again.",
        )

    # Check if registration is enabled via AppConfig
    from ..models import AppConfig
    reg_config = db.query(AppConfig).filter(AppConfig.key == "registration_enabled").first()
    if reg_config and reg_config.value == "false":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is currently disabled. Contact your administrator.",
        )

    # Validate uniqueness
    if get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")

    # Find the default group (Net Managers)
    default_group = db.query(Group).filter(Group.is_default == True).first()

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        is_active=False,      # must be approved first
        is_approved=False,
        is_admin=False,
        group_id=default_group.id if default_group else None,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send confirmation email (non-blocking — ignore failure)
    if user_data.email:
        send_registration_pending_email(user_data.email, user_data.username)

    return {
        "message": "Registration successful. Your account is pending administrator approval.",
        "username": user_data.username,
    }


# ---------------------------------------------------------------------------
# POST /auth/admin-create  (admin creates a user directly, active immediately)
# ---------------------------------------------------------------------------

@router.post("/admin-create", response_model=UserResponse)
async def admin_create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="Username is already taken")
    if user_data.email and db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email is already registered")

    default_group = db.query(Group).filter(Group.is_default == True).first()

    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,
        is_approved=True,
        group_id=default_group.id if default_group else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Re-load with group
    user = get_user_by_username(db, user.username)
    return _build_user_response(user)


# ---------------------------------------------------------------------------
# PUT /auth/change-password
# ---------------------------------------------------------------------------

@router.put("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
