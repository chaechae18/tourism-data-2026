"""Alembic 실행 환경.

접속 정보는 app/mysql.py 의 connection_settings() 를 그대로 쓴다.
그래야 백엔드와 마이그레이션이 항상 같은 DB 를 본다.
"""

from logging.config import fileConfig
from urllib.parse import quote_plus

from alembic import context
from sqlalchemy import create_engine

from app.mysql import connection_settings


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ORM 을 쓰지 않으므로 비교 대상 메타데이터가 없다. (마이그레이션은 SQL 로 직접 쓴다)
target_metadata = None


def database_url() -> str:
    settings = connection_settings()
    password = quote_plus(settings["password"] or "")
    return (
        f"mysql+pymysql://{settings['user']}:{password}"
        f"@{settings['host']}:{settings['port']}/{settings['database']}?charset=utf8mb4"
    )


def run_migrations_offline() -> None:
    # DB 에 붙지 않고 SQL 만 뽑아 볼 때 (alembic upgrade head --sql)
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(database_url(), pool_pre_ping=True)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
