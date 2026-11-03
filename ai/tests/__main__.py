"""모든 시험 실행: ai 폴더에서 python -m tests (LLM 비용 없음)"""
import importlib
import pathlib
import sys
import traceback

failed = total = 0
for path in sorted(pathlib.Path(__file__).parent.glob("test_*.py")):
    module = importlib.import_module(f"tests.{path.stem}")
    for name, test in vars(module).items():
        if name.startswith("test_"):
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
