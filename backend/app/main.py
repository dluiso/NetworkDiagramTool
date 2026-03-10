from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
import json
import os

from .database import engine, Base, SessionLocal
from .models import User, Group, AppConfig
from .core.security import get_password_hash
from .config import get_settings
from .api import auth, scanner, projects
from .api import admin

settings = get_settings()

# Create all tables (new tables only — existing tables are not modified)
Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NetDiagram API",
    description="Network Topology Manager API",
    version="2.0.0",
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS — origins from config (supports comma-separated env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(scanner.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "app": settings.app_name}


# ---------------------------------------------------------------------------
# Database migrations for new columns (safe — skips existing columns)
# ---------------------------------------------------------------------------

def _run_migrations():
    from sqlalchemy import text
    migrations = [
        ("users", "full_name", "VARCHAR(100)"),
        ("users", "is_approved", "BOOLEAN DEFAULT 1"),
        ("users", "activation_token", "VARCHAR(64)"),
        ("users", "group_id", "INTEGER"),
    ]
    with engine.connect() as conn:
        for table, col, col_def in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                conn.commit()
            except Exception:
                pass  # Column already exists — ignore


# ---------------------------------------------------------------------------
# Startup: create default groups and admin user
# ---------------------------------------------------------------------------

DEFAULT_GROUPS = [
    {
        "name": "Administrators",
        "description": "Full system access — can manage users, groups, and configuration",
        "permissions": json.dumps(["admin", "dashboard", "scanner", "projects", "tools", "profile",
                                   "users", "groups", "config"]),
        "is_system": True,
        "is_default": False,
    },
    {
        "name": "Net Managers",
        "description": "Network management — scanner, projects, and tools access",
        "permissions": json.dumps(["dashboard", "scanner", "projects", "tools", "profile"]),
        "is_system": True,
        "is_default": True,
    },
]

DEFAULT_CONFIG = {
    "app_name": ("NetDiagram", "Application display name"),
    "registration_enabled": ("true", "Allow public self-registration"),
    "session_timeout_minutes": ("480", "JWT token lifetime in minutes"),
    "frontend_url": ("http://localhost:5173", "Frontend URL for links in emails"),
}


@app.on_event("startup")
async def startup_event():
    # Run safe column migrations first
    _run_migrations()

    db = SessionLocal()
    try:
        # 1. Create default groups
        group_map = {}
        for gdata in DEFAULT_GROUPS:
            group = db.query(Group).filter(Group.name == gdata["name"]).first()
            if not group:
                group = Group(**gdata)
                db.add(group)
                db.flush()
                print(f"✅ Group created: {gdata['name']}")
            group_map[gdata["name"]] = group

        db.commit()

        # 2. Create default admin user if no admin exists
        admin_user = db.query(User).filter(User.is_admin == True).first()
        if not admin_user:
            admin_group = db.query(Group).filter(Group.name == "Administrators").first()
            admin_user = User(
                username=settings.first_admin_user,
                hashed_password=get_password_hash(settings.first_admin_password),
                is_admin=True,
                is_active=True,
                is_approved=True,
                group_id=admin_group.id if admin_group else None,
            )
            db.add(admin_user)
            db.commit()
            print(f"✅ Admin user created: {settings.first_admin_user}")

        # 3. Ensure existing admin users have a group assigned
        admin_group = db.query(Group).filter(Group.name == "Administrators").first()
        if admin_group:
            db.query(User).filter(
                User.is_admin == True,
                User.group_id == None
            ).update({"group_id": admin_group.id})
            db.commit()

        # 4. Ensure all previously approved users (is_active=True) are marked is_approved=True
        db.query(User).filter(
            User.is_active == True,
            User.is_approved == False
        ).update({"is_approved": True})
        db.commit()

        # 5. Seed default app config entries
        for key, (default_val, description) in DEFAULT_CONFIG.items():
            if not db.query(AppConfig).filter(AppConfig.key == key).first():
                db.add(AppConfig(key=key, value=default_val, description=description))
        db.commit()

        print(f"✅ {settings.app_name} API ready")

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Serve frontend SPA in production
# ---------------------------------------------------------------------------

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        index = os.path.join(frontend_dist, "index.html")
        return FileResponse(index)
