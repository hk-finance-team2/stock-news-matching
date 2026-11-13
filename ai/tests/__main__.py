"""모든 시험 실행: ai 폴더에서 python -m tests (LLM 비용 없음)"""
import importlib
import os
import pathlib
import sys
import tempfile
import traceback

# 시험은 진짜 Slack 에 보내지 않음: .env 에 SLACK_WEBHOOK_URL 이 있어도 비움 (load_dotenv 는 이미 있는 값을 덮어쓰지 않음)
# 11/06 이 줄이 없어서 시험이 #ai-수집-알림 에 "시험"·"MagicMock" 글을 보냄
os.environ["SLACK_WEBHOOK_URL"] = ""
from hk_llm.core import notify  # noqa: E402

notify.STATE_FILE = pathlib.Path(tempfile.mkdtemp()) / "health_state.json"  # 알림 상태도 진짜 파일 말고 임시 파일에
from hk_llm.core import resilience  # noqa: E402

resilience.breaker.path = pathlib.Path(tempfile.mkdtemp()) / "breaker_state.json"  # 차단기 상태도 (시험이 진짜 수집을 쉬게 하지 않게)
from hk_llm.core import press_policy  # noqa: E402

press_policy.OVERRIDE_FILE = pathlib.Path(tempfile.mkdtemp()) / "press_override.json"  # 언론사 방침 바꿈도 (진짜 방침을 안 바꾸게)
from hk_llm.steps import step5_summary  # noqa: E402

# LLM 비용도 진짜 DB 의 오늘 금액에 더하지 않게 임시 파일로 (DB 쪽은 test_llm_usage_db 가 지난 날짜로 따로 시험)
step5_summary.USAGE_STORE = "file"
step5_summary.USAGE_FILE = pathlib.Path(tempfile.mkdtemp()) / "llm_usage.json"

# python -m tests offline: DB·인터넷이 필요한 시험을 뺌 (CI 용)
NEEDS_NETWORK = {"test_step3_save", "test_sns_db", "test_robots", "test_llm_usage_db"}
offline = "offline" in sys.argv
failed = total = 0
for path in sorted(pathlib.Path(__file__).parent.glob("test_*.py")):
    module = importlib.import_module(f"tests.{path.stem}")
    for name, test in vars(module).items():
        if name.startswith("test_") and not (offline and name in NEEDS_NETWORK):
            total += 1
            try:
                test()
                print("ok  ", name)
            except Exception:
                failed += 1
                print("FAIL", name)
                traceback.print_exc()
print(f"{total - failed}/{total} 통과")
sys.exit(1 if failed else 0)
