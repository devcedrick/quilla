"""Render original Family05 charts from canonical exact source data (Pillow)."""
import json,hashlib,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
BANK=ROOT/'content/question-bank/family-05'
DATA=json.loads((ROOT/'scripts/family05-chart-data.json').read_text(encoding='utf8'))
KINDS={'pictograms':'Pictogram','rain':'Interval rainfall bar chart','contest':'Small-multiple event score bars','packing':'Grouped strip-count bars','percentiles':'Score frequency bar chart','ranking':'Quality / service scatter plot','cutting':'Grouped strip-count bars'}
COLORS=['#176c85','#b45229','#6850a0','#54772b']
def font(n,b=False):return ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if b else 'arial.ttf'),n)
def render(r):
 ident=r['referenceId'];short=ident.removeprefix('f05-data-');t=DATA[ident];rows=t['rows'];im=Image.new('RGB',(1600,1000),'white');d=ImageDraw.Draw(im)
 d.text((60,30),r['title'],font=font(37,True),fill='#172d3c');d.text((60,90),'Original fictional data | '+KINDS[short]+' | Exact values labelled',font=font(23),fill='#475966')
 if short=='pictograms':
  d.text((60,160),'Key: diamond = 6 blankets; circle = 2 blankets. Staff shown separately.',font=font(27),fill='#172d3c')
  for i,row in enumerate(rows):
   y=300+i*200;d.text((60,y),'Shelter '+row[0],font=font(32,True),fill='#172d3c')
   for j in range(int(row[1])):
    x=350+j*85;d.polygon([(x,y-25),(x+25,y),(x,y+25),(x-25,y)],fill=COLORS[0])
   for j in range(int(row[2])):
    x=850+j*65;d.ellipse((x-18,y-18,x+18,y+18),fill=COLORS[1])
   d.text((1250,y),row[3]+' staff',font=font(30),fill='#172d3c')
  d.text((60,900),'Each repeated shape represents the same quantity; no partial symbols.',font=font(25),fill='#475966')
 elif short=='ranking':
  L,T,R,B=180,210,1390,800
  for v in range(11):
   x=L+v*(R-L)/10;y=B-v*(B-T)/10;d.line((x,T,x,B),fill='#d8e0e6');d.line((L,y,R,y),fill='#d8e0e6');d.text((x,B+30),str(v),font=font(22),fill='#172d3c',anchor='mm');d.text((L-25,y),str(v),font=font(22),fill='#172d3c',anchor='rm')
  for name,q,s in rows:
   x=L+int(q)*(R-L)/10;y=B-int(s)*(B-T)/10;d.ellipse((x-10,y-10,x+10,y+10),fill=COLORS[0]);d.text((x+18,y-20),f'{name} ({q}, {s})',font=font(27,True),fill='#172d3c')
  d.text((650,900),'Quality score',font=font(28),fill='#172d3c');d.text((60,155),'Vertical axis: service score',font=font(26),fill='#172d3c')
 else:
  cols=len(t['headers'])-1;pw=1480/cols
  for c in range(1,cols+1):
   left=60+(c-1)*pw;cl=left+110;cr=left+pw-90;top,bottom=250,800;vals=[float(row[c]) for row in rows];maximum=max(vals) or 1;maximum=math.ceil(maximum/2)*2
   d.text((left,165),t['headers'][c],font=font(25,True),fill=COLORS[(c-1)%4])
   for tick in range(5):
    x=cl+(cr-cl)*tick/4;d.line((x,top-20,x,bottom+20),fill='#d8e0e6');d.text((x,bottom+50),f'{maximum*tick/4:g}',font=font(20),fill='#172d3c',anchor='mm')
   for i,row in enumerate(rows):
    y=top+(i+.5)*(bottom-top)/len(rows);end=cl+float(row[c])*(cr-cl)/maximum;d.text((cl-15,y),row[0],font=font(23),fill='#172d3c',anchor='rm');d.rectangle((cl,y-22,end,y+22),fill=COLORS[(c-1)%4]);d.text((end+10,y),row[c],font=font(24,True),fill='#172d3c',anchor='lm')
  note='Independent panels; each starts at zero. Category: '+t['headers'][0]
  if short=='rain':note='Rainfall amount per labelled interval; unequal durations. Bars do not show rates.'
  d.text((60,930),note,font=font(24),fill='#475966')
 path=BANK/f'references/assets/{ident}.png';path.parent.mkdir(exist_ok=True,parents=True);im.save(path);return path
if __name__=='__main__':
 refs=json.loads((BANK/'references/analytical-data.json').read_text(encoding='utf8'));assets=[]
 for r in refs:
  short=r['referenceId'].removeprefix('f05-data-')
  if short not in KINDS:continue
  path=render(r);t=DATA[r['referenceId']];description=' '.join(row[0]+': '+', '.join(h+' = '+v for h,v in zip(t['headers'][1:],row[1:]))+'.' for row in t['rows']);aid=r['referenceId']+'-chart'
  image=dict(type='image',assetId=aid,caption=r['title'],alt=KINDS[short]+' for '+r['title']+'. Exact values in description.',description=description)
  r['blocks']=[b for b in r['blocks'] if b['type'] not in ['image','table']]+[image];r['version']=2
  # References to tables now describe the supplied chart; all numerical premises unchanged.
  for b in r['blocks']:
   if b['type']=='text':b['text']=b['text'].replace('The table records','The chart records').replace('patterns in the table','patterns in the chart')
  assets.append(dict(assetId=aid,path=path.relative_to(BANK).as_posix(),mediaType='image/png',sha256=hashlib.sha256(path.read_bytes()).hexdigest(),width=1600,height=1000,provenance=r['provenance']))
 (BANK/'references/analytical-data.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2)+'\n',encoding='utf8');(BANK/'references/chart-assets.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf8')
 qs=json.loads((BANK/'content/analytical-data.json').read_text(encoding='utf8'))
 for q in qs:
  if q['reference']['referenceId'].removeprefix('f05-data-') in KINDS:q['reference']['referenceVersion']=2;q['version']=2
 (BANK/'content/analytical-data.json').write_text(json.dumps(qs,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
