import sys, json, re, collections
path=sys.argv[1]
objs=[]; cur=None; blk=0; lastname=None
def dec(b):
    # PRO100 miesza kodowanie nazw: część UTF-8, część cp1250.
    try: return b.decode('utf-8')
    except UnicodeDecodeError: return b.decode('cp1250')
with open(path,'rb') as f:
    for raw in f:
        line=dec(raw)
        if line.startswith('#block begin'): blk+=1
        elif line.startswith('o '):
            cur={"blk":blk,"name":re.sub(r"^\d+_","",line[2:].strip()),"min":[1e9]*3,"max":[-1e9]*3,"n":0,"mtl":None}; objs.append(cur)
        elif line.startswith('usemtl') and cur: cur["mtl"]=cur["mtl"] or line.split()[1]
        elif line.startswith('v ') and cur is not None:
            p=[float(x) for x in line.split()[1:4]]
            for i in range(3):
                if p[i]<cur["min"][i]:cur["min"][i]=p[i]
                if p[i]>cur["max"][i]:cur["max"][i]=p[i]
            cur["n"]+=1
json.dump(objs,open('objs.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(objs),"objects")
c=collections.Counter(re.sub(r'^\d+_','',o["name"]) for o in objs)
for k,v in c.most_common(80): print(v,repr(k))
