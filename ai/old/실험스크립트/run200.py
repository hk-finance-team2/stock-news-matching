"""FETCHED 200건 요약 + 매칭. 수집·본문 수집 안 함. 토큰만 세려고 summarize 를 감쌈"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
from hk_llm.core.db import get_engine
import hk_llm.steps.step5_summary as s5
from hk_llm.steps.step6_match import match_articles
e=get_engine(); t=[0,0,0]; orig=s5.summarize
def wrap(*a,**k):
    r=orig(*a,**k); t[0]+=r[1]["input_tokens"]; t[1]+=r[1]["output_tokens"]; t[2]+=1; return r
s5.summarize=wrap
try:
    n=s5.summarize_articles(e,200)
    print("저장",n); match_articles(e)
finally:
    print(f"성공 호출 {t[2]} 토큰 {t[0]}/{t[1]} 비용 ${t[0]*.2/1e6+t[1]*1.25/1e6:.4f}")
