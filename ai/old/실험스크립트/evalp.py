"""프롬프트 평가: 10건 x 3회. DB 쓰기 없음. 사용: evalp.py 라벨"""
import sys as _s; _s.stdout.reconfigure(encoding="utf-8")
import json,re,sys,collections
from sqlalchemy import text
from hk_llm.core.db import get_engine
from hk_llm.steps.step5_summary import summarize
label=sys.argv[1]; out=sys.argv[2]
# 기대값: 주인공 이름 조각(없으면 빈 목록), None=판정 안 함
EXP={390:[],440:[],1203:[],1211:["현대차","현대자동차"],9:["영광"],363:["현대"],6:["LG씨엔에스","LG CNS"],7:["한국철강"],1123:["POSCO","포스코홀딩스"],416:["에이피알"]}
NEUTRAL_EXP={363}  # 홍보성: 그날 감성 NEUTRAL 기대
num=re.compile(r'\d[\d,.]*\d|\d'); n=lambda s:s.replace(',','')
ids=list(EXP)
with get_engine().connect() as c:
    rows={r['article_id']:r for r in c.execute(text("select article_id,title,body from article where article_id in :i").bindparams(__import__('sqlalchemy').bindparam('i',expanding=True)),{"i":ids}).mappings()}
res=[];ti=to=0;errs=[]
for run in range(1,4):
    for i in ids:
        r=rows[i]
        try:
            s,u=summarize(r['title'],r['body'])
        except Exception as e:
            errs.append((run,i,type(e).__name__,str(e)[:120]));continue
        ti+=u['input_tokens'];to+=u['output_tokens']
        res.append({"run":run,"id":i,**s.model_dump()})
json.dump(res,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print(f"[{label}] 성공 {len(res)}/30, 오류 {errs}, 비용 ${ti*0.2/1e6+to*1.25/1e6:.4f}, 평균 입력 {ti//max(len(res),1)}/출력 {to//max(len(res),1)}")
ok=tot=0;sent_ok=sent_tot=0
print("--- 판단: 회차별 주인공 / 맞음 여부")
for i in ids:
    line=[]
    for x in [y for y in res if y['id']==i]:
        mains=[c['name'] for c in x['companies'] if c['is_main']]
        if EXP[i] is None: g='-'
        else:
            g='O' if (bool(mains)==bool(EXP[i]) and (not EXP[i] or any(k in m for m in mains for k in EXP[i]))) else 'X'
            tot+=1; ok+=g=='O'
        line.append(f"{g}{mains}")
    print(i,' | '.join(line))
print(f"주인공 정답 {ok}/{tot}")
for i in NEUTRAL_EXP:
    v=[c['sentiment'] for x in res if x['id']==i for c in x['companies'] if c['is_main']]
    print("홍보성 363 그날 감성",v)
same=diff=0
for i in ids:
    d=collections.defaultdict(list)
    for x in [y for y in res if y['id']==i]:
        for c in x['companies']: d[c['name']].append((c['is_main'],c['sentiment'],c['long_term']))
    cnt=sum(1 for x in res if x['id']==i)
    for k,v in d.items():
        if len(v)==cnt and len(set(v))==1: same+=1
        else: diff+=1
print(f"회사별 3회 일치 {same}, 불일치(이름·주인공·감성) {diff}")
print("--- 검정")
S=[len(x['summary']) for x in res]; R=[c['reason'] for x in res for c in x['companies']]; K=[k for x in res for k in x['keywords']]
print(f"요약 평균 {sum(S)//len(S)}자, 최대 {max(S)}, 200자 초과 {sum(l>200 for l in S)}/{len(S)}")
print(f"이유 40자 초과 {sum(len(r)>40 for r in R)}/{len(R)}, 키워드 숫자 포함 {sum(bool(re.search(r'[0-9]',k)) for k in K)}/{len(K)}, 키워드 개수 범위밖 {sum(not 3<=len(x['keywords'])<=5 for x in res)}/{len(res)}")
print("문장끝 이상",[ (x['run'],x['id']) for x in res if not re.search(r'(다|다\.)\s*$',x['summary'])])
print("--- 검증")
bad=[]
for x in res:
    src=n(rows[x['id']]['title']+' '+rows[x['id']]['body'])
    for t in [x['summary']]+[c['reason'] for c in x['companies']]:
        for m in num.findall(t):
            if n(m).rstrip('.') not in src: bad.append((x['run'],x['id'],m))
    for c in x['companies']:
        nm=re.sub(r'\(.*?\)','',c['name']).replace(' ','')
        if nm not in src.replace(' ',''): bad.append((x['run'],x['id'],'회사?',c['name']))
print("원문에 없는 숫자·회사",bad)
print("회사 수(회차별)",{i:[len(x['companies']) for x in res if x['id']==i] for i in ids})
print("--- 요약 1회차 일부"); 
for x in res:
    if x['run']==1 and x['id'] in (9,390,1211): print(x['id'],x['summary'])
print("--- 컨센서스: 주인공 (그날감성, 장기) 회차별")
for i in (416,6,1123):
    print(i,[[(c['name'],c['sentiment'],c['long_term']) for c in x['companies'] if c['is_main']] for x in res if x['id']==i])
print("416 이유/요약 1회차:",[(c['reason']) for x in res if x['id']==416 and x['run']==1 for c in x['companies']], [x['summary'] for x in res if x['id']==416 and x['run']==1])
print("--- 연결 회사(회차별)")
for i in (390,440,1203,1211):
    print(i,[[c['name'] for c in x['companies']] for x in res if x['id']==i])
