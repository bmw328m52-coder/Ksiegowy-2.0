import json, re
objs=json.load(open('objs.json',encoding='utf-8'))
P=[]
for i,o in enumerate(objs):
    if o["n"]==0: continue
    mn=[v*1000 for v in o["min"]]; mx=[v*1000 for v in o["max"]]
    P.append(dict(i=i,name=o["name"],mn=mn,mx=mx,sz=[b-a for a,b in zip(mn,mx)]))
def thin(p):  # axis of thickness (0=x,1=y,2=z) for 16-20mm panels
    s=p["sz"]; a=min(range(3),key=lambda k:s[k]); return a if 15<=s[a]<=20 else None
def kind(n):
    n=n.lower()
    if 'wisz' in n: return 'górna'
    if 'nadstawki na blat' in n or 'nadstawki bla' in n: return 'nadstawka na blat'
    if 'nadstawk' in n: return 'nadstawka'
    if 'słupk' in n: return 'słupek'
    if 'szafki dolnej' in n or 'ślepy' in n: return 'dolna'
    return None
sides=[p for p in P if p["name"].lower().startswith('bok') and thin(p) in (0,2)]
horiz=[p for p in P if thin(p)==1 and re.search(r'(?i)wieniec|dno wisz',p["name"])]
cabs=[]; used=set()
for a in sides:
    ax=thin(a); oth=2 if ax==0 else 0
    best=None
    for b in sides:
        if b is a or thin(b)!=ax or b["i"] in used: continue
        if b["mn"][ax]<=a["mn"][ax]: continue
        if abs(b["mn"][1]-a["mn"][1])>5 or abs(b["sz"][1]-a["sz"][1])>5: continue
        if min(a["mx"][oth],b["mx"][oth])-max(a["mn"][oth],b["mn"][oth])<200: continue
        gap=b["mn"][ax]-a["mx"][ax]
        if not (80<gap<1300): continue
        # wieniec/dno between them
        ok=any(h["mn"][ax]>=a["mx"][ax]-3 and h["mx"][ax]<=b["mn"][ax]+3 and h["sz"][ax]>gap-40
               and a["mn"][1]-5<=h["mn"][1]<=a["mx"][1]+5 for h in horiz)
        if ok and (best is None or b["mn"][ax]<best["mn"][ax]): best=b
    if best:
        used.add(a["i"]); used.add(best["i"])
        mn=[min(a["mn"][k],best["mn"][k]) for k in range(3)]; mx=[max(a["mx"][k],best["mx"][k]) for k in range(3)]
        cabs.append(dict(type=kind(a["name"]) or kind(best["name"]) or '?',ax=ax,mn=mn,mx=mx,
            w=round(mx[ax]-mn[ax]),h=round(mx[1]-mn[1]),d=round(mx[oth]-mn[oth]),elev=round(mn[1])))
def inside(p,c,pad=25):
    return all(p["mn"][k]>=c["mn"][k]-pad and p["mx"][k]<=c["mx"][k]+pad for k in range(3))
for c in cabs:
    ax=c["ax"]; oth=2 if ax==0 else 0
    # fronts: panels in front plane (thin along oth), overlapping cabinet span
    fr=[p for p in P if re.search(r'(?i)front|tafla',p["name"]) and thin(p)==oth
        and min(p["mx"][ax],c["mx"][ax])-max(p["mn"][ax],c["mn"][ax])>0.6*min(p["sz"][ax],c["w"])
        and min(p["mx"][1],c["mx"][1])-max(p["mn"][1],c["mn"][1])>0.6*p["sz"][1]
        and (abs(p["mx"][oth]-c["mn"][oth])<60 or abs(p["mn"][oth]-c["mx"][oth])<60)]
    c["fronts"]=[(round(p["sz"][ax]),round(p["sz"][1])) for p in fr]
    c["drawers"]=sum(1 for p in P if p["name"].lower().startswith('dno szuflady') and inside(p,c))
    c["shelves"]=sum(1 for p in P if p["name"].lower().startswith('półka') and inside(p,c))
cabs.sort(key=lambda c:(c["type"],c["elev"],c["mn"][0],c["mn"][2]))
for c in cabs:
    print(f'{c["type"]:18} {c["w"]:5}×{c["h"]:5}×{c["d"]:4} wys.od podł.{c["elev"]:5}  fronty:{len(c["fronts"])} {c["fronts"]}  szuflady:{c["drawers"]} półki:{c["shelves"]}')
print(len(cabs),"szafek; boki bez pary:",[p["name"] for p in sides if p["i"] not in used])
json.dump(cabs,open('cabs.json','w',encoding='utf-8'),ensure_ascii=False)
