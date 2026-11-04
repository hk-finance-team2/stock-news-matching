import json,sys
sys.stdout.reconfigure(encoding="utf-8")
for x in json.load(open(sys.argv[1],encoding="utf-8")):
    d=[n for n in x["links"] if n not in x["new"]]
    if d: print(x["id"],x["t"][:40],"빠지는 연결:",d[:6],len(d))
