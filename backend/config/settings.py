"""Django settings for the Play Gyeongju backend.

INSTALLED_APPS is deliberately minimal: no admin, auth, sessions or
contenttypes. The MySQL schema is owned by the team DDL, and every model here
is unmanaged, so `migrate` must not create Django's own bookkeeping tables in
the shared database.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "corsheaders",
    "rest_framework",
    "core",
    "main",
    "tourapi",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Empty DB_NAME means "no MySQL configured yet" — fall back to SQLite so the
# server still boots. The unmanaged models will simply find no tables.
if os.environ.get("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.environ["DB_NAME"],
            "USER": os.environ.get("DB_USER", ""),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "3306"),
            "OPTIONS": {
                "charset": "utf8mb4",
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

REST_FRAMEWORK = {
    # JSON only. The browsable API would drag in templates and staticfiles.
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "UNAUTHENTICATED_USER": None,
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

LANGUAGE_CODE = "ko"
TIME_ZONE = "Asia/Seoul"
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

TEST_RUNNER = "config.test_runner.UnmanagedModelTestRunner"

# --- 한국관광공사 TourAPI -------------------------------------------------
TOURAPI_SERVICE_KEY = os.environ.get("TOURAPI_SERVICE_KEY", "")
TOURAPI_BASE_URL = os.environ.get(
    "TOURAPI_BASE_URL", "https://apis.data.go.kr/B551011/KorService2"
)
TOURAPI_MOBILE_APP = os.environ.get("TOURAPI_MOBILE_APP", "PlayGyeongju")
TOURAPI_AREA_CODE = os.environ.get("TOURAPI_AREA_CODE", "35")
TOURAPI_SIGUNGU_CODE = os.environ.get("TOURAPI_SIGUNGU_CODE", "2")
TOURAPI_LDONG_REGN_CD = os.environ.get("TOURAPI_LDONG_REGN_CD", "47")
TOURAPI_LDONG_SIGNGU_CD = os.environ.get("TOURAPI_LDONG_SIGNGU_CD", "130")

