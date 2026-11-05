"""Render original Family06 charts from immutable pre-chart canonical tables.
Pillow only; no inference or answer-derived values are plotted.
Run from repo root using a Python runtime with Pillow installed.
"""
import json, math, hashlib, copy
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
BANK=ROOT/'content/question-bank/family-06'
SOURCE=ROOT/'scripts/family06-chart-data.json'
COLORS=['#176C85','#A54A1D','#6654A2','#637B33']
def font(n,b=False):return ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if b else 'arial.ttf'),n)
def chart(ref):
 t=next(b for b in ref['blocks'] if b['type']=='table'); slug=ref['referenceId'].removeprefix('f06-data-');rows=t['rows'];headers=t['headers']; im=Image.new('RGB',(1800,1100),'white');d=ImageDraw.Draw(im)
 d.text((60,30),ref['title'],font=font(38,True),fill='#132D3C');d.text((60,90),'Original fictional practice data | Exact values labelled | '+('Shared zero-based count axis' if slug=='queue' else 'Read each panel scale separately'),font=font(24),fill='#475966')
 if slug=='queue':
  left,right,top,bottom=200,1600,270,860; maximum=12
  d.text((70,165),'People per interval (not cumulative queue size)',font=font(27,True),fill='#172D3C')
  for v in range(0,13,2):
   y=bottom-v/maximum*(bottom-top);d.line((left,y,right,y),fill='#D8E0E6',width=2);d.text((left-25,y),str(v),font=font(24),fill='#172D3C',anchor='rm')
  for col in (1,2):
   points=[]
   for i,r in enumerate(rows):
    x=left+i*(right-left)/3;y=bottom-float(r[col])/maximum*(bottom-top);points.append((x,y))
   d.line(points,fill=COLORS[col-1],width=6)
   for i,(x,y) in enumerate(points):
    if col==1:d.ellipse((x-9,y-9,x+9,y+9),fill=COLORS[0])
    else:d.rectangle((x-9,y-9,x+9,y+9),fill=COLORS[1])
    # Above/below labels separate adjacent values at interval IV.
    d.text((x,y+(-30 if col==1 else 32)),rows[i][col],font=font(28,True),fill=COLORS[col-1],anchor='mm')
   lx=350+(col-1)*700;ly=1020;d.line((lx,ly,lx+70,ly),fill=COLORS[col-1],width=6)
   if col==1:d.ellipse((lx+28,ly-8,lx+44,ly+8),fill=COLORS[0])
   else:d.rectangle((lx+28,ly-8,lx+44,ly+8),fill=COLORS[1])
   d.text((lx+95,ly),headers[col],font=font(26),fill='#172D3C',anchor='lm')
  for i,r in enumerate(rows):d.text((left+i*(right-left)/3,bottom+55),r[0],font=font(28),fill='#172D3C',anchor='mm')
  d.text((70,950),'Intervals I-IV in sequence; lines link interval counts only.',font=font(24),fill='#334955')
 elif slug=='weights':
  # Discrete frequency columns: no joining line suggests continuous mass.
  left,right,top,bottom=210,1630,230,880; maximum=5
  d.text((80,160),'Number of bags',font=font(26,True),fill=COLORS[0])
  for v in range(6):
   y=bottom-v/maximum*(bottom-top);d.line((left,y,right,y),fill='#D8E0E6',width=2);d.text((left-25,y),str(v),font=font(23),fill='#172D3C',anchor='rm')
  for i,r in enumerate(rows):
   x=left+(i+.5)*(right-left)/len(rows);y=bottom-int(r[1])/maximum*(bottom-top);d.rectangle((x-95,y,x+95,bottom),fill=COLORS[0]);d.text((x,y-25),r[1],font=font(30,True),fill='#172D3C',anchor='mm');d.text((x,bottom+45),r[0]+' kg',font=font(27),fill='#172D3C',anchor='mm')
  d.text((70,995),'Bag mass (discrete categories; each label gives the exact mass)',font=font(25),fill='#334955')
 elif slug=='ratings':
  # Two independent pies, fixed radius: angle represents proportion, labels preserve counts.
  for i,r in enumerate(rows):
   cx=470+i*860;cy=590;rad=270;angle=-90;total=sum(map(float,r[1:]));d.text((cx,190),r[0]+' session',font=font(30,True),fill='#172D3C',anchor='mm')
   for j,v in enumerate(map(float,r[1:])):
    end=angle+v/total*360;d.pieslice((cx-rad,cy-rad,cx+rad,cy+rad),angle,end,fill=COLORS[j],outline='white',width=4);mid=math.radians((angle+end)/2);d.text((cx+rad*.64*math.cos(mid),cy+rad*.64*math.sin(mid)),str(int(v)),font=font(30,True),fill='white',anchor='mm');angle=end
   for j,label in enumerate(headers[1:]):d.rectangle((cx-300,920+j*50,cx-270,950+j*50),fill=COLORS[j]);d.text((cx-250,920+j*50),label+': '+r[j+1],font=font(25),fill='#172D3C')
  d.text((60,1045),'Sector sizes show proportions within each session; numbers show people, not percentages.',font=font(24),fill='#334955')
 else:
  n=len(headers)-1;pw=1680/n
  for col in range(1,len(headers)):
   origin=60+(col-1)*pw;left=origin+140;right=origin+pw-65;top=270;bottom=850
   values=[float(r[col]) for r in rows];axis=math.ceil(max(values)/5)*5 or 5
   label=headers[col]
   if slug=='inventory':label={'Opening':'Opening (units)','Received':'Received (units)','Issued':'Issued (units)','Cost':'Cost (pesos/unit)'}[label]
   if slug in ('returns','survival'):label+=' (count)'
   if slug=='queue':label+=' (people)'
   d.text((origin,170),label,font=font(23,True),fill=COLORS[(col-1)%4])
   for k in range(6):
    v=axis*k/5;x=left+(right-left)*k/5;d.line((x,top-25,x,bottom+25),fill='#D8E0E6',width=2);d.text((x,bottom+60),f'{v:g}',font=font(20),fill='#334955',anchor='mm')
   for i,r in enumerate(rows):
    y=top+(i+.5)*(bottom-top)/len(rows);end=left+float(r[col])/axis*(right-left);d.text((left-16,y),r[0],font=font(23),fill='#172D3C',anchor='rm');
    if end>left:d.rectangle((left,y-26,end,y+26),fill=COLORS[(col-1)%4])
    d.text((end+8,y),r[col],font=font(24,True),fill='#172D3C',anchor='lm')
   d.text((origin,1000),'Category: '+headers[0],font=font(22),fill='#334955')
 path=BANK/'references/assets'/('f06-'+slug+'.png');path.parent.mkdir(exist_ok=True);im.save(path);return path

def fingerprint(f):
 if f.suffix=='.json':return hashlib.sha256(json.dumps(json.loads(f.read_text(encoding='utf-8-sig')),sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 return hashlib.sha256(f.read_bytes()).hexdigest()

def main():
 existing_state={str(f.relative_to(BANK)):fingerprint(f) for f in BANK.rglob('*') if f.is_file() and f.name!='manifest.json'}
 canonical=json.loads(SOURCE.read_text(encoding='utf-8-sig')); refs=copy.deepcopy(canonical);assets=[];changed=[]
 for ref in refs:
  slug=ref['referenceId'].removeprefix('f06-data-')
  if slug in ('capacity','score'):continue
  t=next(b for b in ref['blocks'] if b['type']=='table');path=chart(ref);asset='f06-'+slug+'-chart';description='Exact plotted values. Columns: '+ '; '.join(t['headers'])+'. Rows: '+ '; '.join(', '.join(r) for r in t['rows'])+'.'
  ref['blocks']=[b if b['type']!='table' else {'type':'image','assetId':asset,'caption':ref['title'],'alt':ref['title']+'; exact data are provided in the description.','description':description} for b in ref['blocks']];ref['blocks']=[dict(b,text=b['text'].replace('in the table','in the chart')) if b['type']=='text' else b for b in ref['blocks']];ref['version']=2;changed.append(ref['referenceId']);assets.append({'assetId':asset,'path':path.relative_to(BANK).as_posix(),'mediaType':'image/png','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'width':1800,'height':1100,'provenance':ref['provenance']})
 (BANK/'references/analytical-data.json').write_text(json.dumps(refs,indent=2,ensure_ascii=False)+'\n',encoding='utf8');(BANK/'references/analytical-chart-assets.json').write_text(json.dumps(assets,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
 p=BANK/'content/analytical-data.json';q=json.loads(p.read_text(encoding='utf-8-sig'))
 for item in q:
  if item.get('reference',{}).get('referenceId') in changed:item['version']=2;item['reference']['referenceVersion']=2;item['stem']=item['stem'].replace('the table','the chart').replace('the table','the chart')
 p.write_text(json.dumps(q,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
 p=BANK/'manifest.json';m=json.loads(p.read_text(encoding='utf-8-sig'));m['revision']=2;
 # Keep a pinned checksum only when every declared corpus record/asset is identical.
 previous=existing_state
 current={str(f.relative_to(BANK)):fingerprint(f) for f in BANK.rglob('*') if f.is_file() and f.name!='manifest.json'}
 if current!=previous:m.pop('datasetChecksum',None)
 m['sources'][0]['assetFiles']=['references/analytical-chart-assets.json'];p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf8')
 print('Rendered',len(assets),'charts; references and linked questions version2; checksum preserved if corpus unchanged.')
if __name__=='__main__':main()


