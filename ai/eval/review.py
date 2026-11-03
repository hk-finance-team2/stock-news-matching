"""정답지 검수 화면 만들기: 정답지에서 20건을 뽑아 사람이 "맞음 / 고칠 점 있음"을 누르는 HTML

    python -m eval.review          (ai 폴더에서) → 레포 data/eval/review.html (Git 제외: 기사 앞부분이 들어 있음)

- 검수 결과는 화면 아래 "결과 복사"로 JSON 을 복사 → eval/review_result.json 에 저장해 일치율을 냄
- 검수하는 사람은 정답지(Claude 가 만든 것)만 보고, AI 파이프라인의 답은 보지 않음
"""
import html
import json
import random
from pathlib import Path

from sqlalchemy import bindparam, text

from eval.score import load_gold
from hk_llm.core.db import get_engine

SEED = 1103
N = 20
LEAD = 400
OUT = Path(__file__).parent.parent.parent / "data" / "eval" / "review.html"
TYPE = {"DIRECT": "직접", "INDIRECT": "간접"}
SENT = {"POSITIVE": "호재", "NEGATIVE": "악재", "NEUTRAL": "중립"}


def main():
    gold = load_gold()
    items = random.Random(SEED).sample(gold, min(N, len(gold)))
    keys = [g["url_key"] for g in items]
    codes = sorted({s["code"] for g in items for s in g["stocks"]})
    with get_engine().connect() as conn:
        arts = {r.url_key: r for r in conn.execute(text(
            "SELECT url_key, url, press, published_at, title, body FROM article WHERE url_key IN :k"
        ).bindparams(bindparam("k", expanding=True)), {"k": keys})}
        names = dict(conn.execute(text("SELECT stock_code, stock_name FROM stock_info WHERE stock_code IN :c"
                                       ).bindparams(bindparam("c", expanding=True)), {"c": codes or [""]}).all())
    cards = []
    for i, g in enumerate(items):
        a = arts[g["url_key"]]
        stocks = "".join(
            f"<li><b>{html.escape(names.get(s['code'], s['code']))}</b> {s['code']} · {TYPE[s['type']]} · "
            f"{'주인공' if s['main'] else '조연'} · {SENT[s['sentiment']]}</li>" for s in g["stocks"]
        ) or "<li><b>연결 없음</b></li>"
        note = f"<p class='note'>메모: {html.escape(g['note'])}</p>" if g.get("note") else ""
        cards.append(f"""<section class="card" data-key="{html.escape(g['url_key'])}">
<h2>{i + 1}. <a href="{html.escape(a.url)}" target="_blank" rel="noopener">{html.escape(a.title)}</a></h2>
<p class="meta">{html.escape(a.press)} · {a.published_at:%Y-%m-%d %H:%M}</p>
<p class="lead">{html.escape((a.body or '')[:LEAD])}…</p>
<div class="gold"><span>Claude 정답</span><ul>{stocks}</ul>{note}</div>
<div class="act"><label><input type="radio" name="r{i}" value="ok"> 맞음</label>
<label><input type="radio" name="r{i}" value="fix"> 고칠 점 있음</label>
<input class="why" placeholder="고칠 점 (예: SK하이닉스 빠짐, 삼성전자는 조연)"></div></section>""")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(PAGE.replace("{{cards}}", "\n".join(cards)).replace("{{n}}", str(len(items))), encoding="utf-8")
    print(f"{len(items)}건 → {OUT}")


PAGE = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>정답지 검수</title><style>
:root{--bg:#F7F8FA;--card:#fff;--text:#1D2939;--muted:#667085;--line:#E4E7EC;--accent:#155EEF}
@media (prefers-color-scheme:dark){:root{--bg:#0F1115;--card:#181B21;--text:#E6E8EB;--muted:#98A2B3;--line:#2A2F37;--accent:#6E9BFF}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}
h1{font-size:20px}.guide{color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}
.card h2{font-size:16px;margin:0 0 4px}.card a{color:var(--accent)}
.meta{color:var(--muted);font-size:13px;margin:0}.lead{font-size:14px;margin:8px 0}
.gold{border-top:1px dashed var(--line);padding-top:8px}.gold span{font-size:13px;color:var(--muted)}
.gold ul{margin:4px 0 0;padding-left:20px}.note{font-size:13px;color:var(--muted);margin:4px 0 0}
.act{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px}
.why{flex:1;min-width:200px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)}
.bar{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-size:15px;cursor:pointer}
</style></head><body><main>
<h1>정답지 검수 ({{n}}건)</h1>
<p class="guide">Claude 가 라벨 기준(ai/docs/평가/라벨_기준.md)대로 단 정답이 맞는지 봐 주세요. 제목을 누르면 원문이 열립니다.
연결 종목·직접/간접·주인공/조연·호재/악재 중 하나라도 다르면 "고칠 점 있음"과 이유를 적어 주세요. 다 끝나면 아래 "결과 복사" → 채팅에 붙여 넣기.</p>
{{cards}}
</main><div class="bar"><span id="cnt"></span><button id="copy">결과 복사</button></div>
<script>
const cards=[...document.querySelectorAll('.card')];
function result(){return cards.map(c=>({url_key:c.dataset.key,verdict:(c.querySelector('input[type=radio]:checked')||{}).value||null,why:c.querySelector('.why').value.trim()}));}
function update(){const r=result();document.getElementById('cnt').textContent=`검수 ${r.filter(x=>x.verdict).length}/${r.length} · 맞음 ${r.filter(x=>x.verdict==='ok').length}`;try{localStorage.setItem('review',JSON.stringify(r))}catch(e){}}
try{const saved=JSON.parse(localStorage.getItem('review')||'[]');saved.forEach((s,i)=>{const c=cards[i];if(!c||c.dataset.key!==s.url_key)return;if(s.verdict){const el=c.querySelector(`input[value=${s.verdict}]`);if(el)el.checked=true}c.querySelector('.why').value=s.why||''})}catch(e){}
document.addEventListener('input',update);update();
document.getElementById('copy').onclick=async()=>{const t=JSON.stringify(result());try{await navigator.clipboard.writeText(t);document.getElementById('copy').textContent='복사됨'}catch(e){prompt('이 글을 복사하세요',t)}};
</script></body></html>"""


if __name__ == "__main__":
    main()
