FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY db ./db
# DB 마이그레이션. 백엔드가 뜰 때 여기 있는 파일들로 스키마를 최신까지 맞춘다.
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY sync_tourapi.py ./sync_tourapi.py
COPY sync_persona_scores.py ./sync_persona_scores.py

RUN mkdir -p /app/uploads \
    && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
