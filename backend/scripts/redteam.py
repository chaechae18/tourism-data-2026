#!/usr/bin/env python3
"""Run security scenarios against a disposable loopback-only MySQL, never .env.

Usage from repository root: backend/.venv/bin/python backend/scripts/redteam.py
Exit codes: 0 all pass, 1 security expectation failed, 2 infrastructure error.
"""
import json
import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
REPORT_DIR = ROOT / "docs" / "redteam"
VERSION = "v2-2026-09-20"


def source_digest():
    digest = hashlib.sha256()
    files = set()
    for folder, pattern in [(BACKEND / "app", "*.py"), (BACKEND / "tests", "*.py"),
                            (BACKEND / "alembic", "*.py"), (BACKEND / "scripts", "*.py")]:
        files.update(folder.rglob(pattern))
    files.update((BACKEND / "db").glob("*.sql"))
    for path in sorted(files):
        digest.update(str(path.relative_to(ROOT)).encode() + b"\0" + path.read_bytes())
    return digest.hexdigest()


def command(*args, **kwargs):
    return subprocess.run(args, text=True, check=True, capture_output=True, timeout=120, **kwargs).stdout.strip()


def write_report(xml_path, pytest_code):
    cases = []
    for node in ET.parse(xml_path).iter("testcase"):
        properties = {p.attrib["name"]: p.attrib["value"] for p in node.findall("./properties/property")}
        failure = node.find("failure")
        outcome = "ERROR" if node.find("error") is not None else (
            ("OPEN" if "AssertionError" in failure.get("message", "") or failure.get("message", "").startswith("assert ")
             else "ERROR") if failure is not None else (
                "SKIP" if node.find("skipped") is not None else "PASS"))
        cases.append({"scenario": node.attrib["name"], "outcome": outcome, **properties})
    result = {
        "version": VERSION, "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_head": command("git", "rev-parse", "HEAD", cwd=ROOT),
        "working_tree_dirty": bool(command("git", "status", "--porcelain", cwd=ROOT)),
        "backend_source_sha256": source_digest(),
        "environment": "ASGI TestClient + disposable mysql:8.4; external network blocked; synthetic users only",
        "pytest_exit_code": pytest_code,
        "counts": {state: sum(c["outcome"] == state for c in cases) for state in ("PASS", "OPEN", "ERROR", "SKIP")},
        "scenarios": cases,
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    (REPORT_DIR / "report.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")
    lines = ["# Play Gyeongju 레드팀 실행 결과", "", f"- 시나리오 버전: {VERSION}",
             f"- 실행 시각(UTC): {result['generated_at']}", f"- 기준 커밋: `{result['git_head']}`",
             f"- 미커밋 변경 포함: {result['working_tree_dirty']}", f"- 환경: {result['environment']}",
             f"- 백엔드 소스·테스트 SHA-256: `{result['backend_source_sha256']}`",
             f"- 결과: {result['counts']}", "",
             "OPEN은 보안 기대 조건을 충족하지 못한 재현 결과입니다. ERROR/SKIP은 검증 완료로 세지 않습니다.",
             "위험도는 해당 검사가 실패했을 때의 영향이며 PASS 항목의 위험을 뜻하지 않습니다.",
             "통과 항목만으로 전체 서비스의 안전성을 보장하지 않습니다. 배포 환경·실제 LLM·브라우저 공격은 별도 검증 대상입니다.",
             "", "재실행: `backend/.venv/bin/python backend/scripts/redteam.py`", "",
             "검토와 대응 우선순위: [review.md](review.md)", "",
             "| 시나리오 | 위험도 | 기대 조건 | 관찰 | 판정 |", "|---|---|---|---|---|"]
    for case in cases:
        lines.append("| " + " | ".join(cell(v) for v in [case["scenario"], case.get("risk", "—"),
            case.get("expected", "—"), "; ".join(filter(None, [case.get("observed"), case.get("effect")])), case["outcome"]]) + " |")
    (REPORT_DIR / "report.md").write_text("\n".join(lines) + "\n")
    print(json.dumps(result["counts"], ensure_ascii=False), flush=True)
    print(f"Report: {REPORT_DIR / 'report.md'}", flush=True)
    if not cases or result["counts"]["ERROR"] or result["counts"]["SKIP"] or pytest_code not in (0, 1):
        return 2
    return 1 if result["counts"]["OPEN"] else 0


def main():
    container = "gyeongju-redteam-" + secrets.token_hex(4)
    password = secrets.token_urlsafe(24)
    started = False
    with tempfile.TemporaryDirectory(prefix="gyeongju-redteam-") as scratch:
        try:
            print("Starting isolated MySQL (production .env is disabled)...", flush=True)
            command("docker", "run", "--rm", "-d", "--name", container,
                    "-e", f"MYSQL_ROOT_PASSWORD={password}", "-p", "127.0.0.1::3306", "mysql:8.4")
            started = True
            port = command("docker", "port", container, "3306/tcp").rsplit(":", 1)[1]
            # Do not pass application credentials or inherited database configuration.
            env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR", "LANG", "SYSTEMROOT") if k in os.environ}
            env.update({
                "PYTHON_DOTENV_DISABLED": "1", "REDTEAM_ISOLATED": "1", "PYTHONPATH": str(BACKEND),
                "DB_HOST": "127.0.0.1", "DB_PORT": port, "DB_USER": "root", "DB_PASSWORD": password,
                "DB_NAME": "play_gyeongju_redteam", "TEST_DB_NAME": "play_gyeongju_redteam",
                "DB_SSL": "false", "DB_AUTO_MIGRATE": "false",
                "SESSION_SECRET_KEY": secrets.token_urlsafe(32), "UPLOAD_DIR": str(Path(scratch) / "uploads"),
                "CORS_ORIGINS": "https://testserver", "ADMIN_API_KEY": "redteam-admin-only",
            })
            # Verify authenticated TCP readiness rather than mysqladmin's unauthenticated liveness.
            probe = "import os,pymysql; c=pymysql.connect(host='127.0.0.1',port=int(os.environ['DB_PORT']),user='root',password=os.environ['DB_PASSWORD']); c.close()"
            for _ in range(45):
                ready = subprocess.run([sys.executable, "-c", probe], env=env, capture_output=True, timeout=5)
                if ready.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError("Disposable MySQL did not become ready")
            xml_path = Path(scratch) / "results.xml"
            run = subprocess.run([sys.executable, "-m", "pytest", "tests/redteam/scenarios.py", "-q", "--tb=short",
                                  "-o", "junit_family=legacy", f"--junitxml={xml_path}"], cwd=BACKEND, env=env, timeout=300)
            if not xml_path.exists():
                raise RuntimeError("Tests did not produce a report")
            return write_report(xml_path, run.returncode)
        except (OSError, RuntimeError, subprocess.SubprocessError) as error:
            # Avoid logging the docker command: it contains a temporary password.
            print(f"Red-team infrastructure error: {type(error).__name__}. Check Docker and backend dev dependencies.", file=sys.stderr)
            return 2
        finally:
            if started:
                subprocess.run(["docker", "rm", "-f", container], capture_output=True, timeout=30)


if __name__ == "__main__":
    raise SystemExit(main())
