"""Deterministic original Family07 charts. Canonical data, no answer overlays.
Run from repo root with Python/Pillow. Does not modify manifests or questions.
"""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent.parent; B=R/'content/question-bank/family-07'
C=['#146880','#A24726','#6654A1']; F=lambda n,b=False:ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if b else 'arial.ttf'),n)
def render(r):
 im=Image.new('RGB',(1600,1000),'white');d=ImageDraw.Draw(im);rows=r['rows'];typ=r['chartType']; L,T,W,H=150,210,1290,590
 def txt(x,y,s,n=25,anchor=None,c='#183743'):d.text((x,y),str(s),font=F(n),fill=c,anchor=anchor)
 d.text((60,35),r['title'],font=F(38,True),fill='#173744');txt(60,100,'Original fictional data | Exact values labelled | '+typ,24)
 def axis(mx,steps=5):
  for k in range(steps+1):
   v=mx*k/steps;y=T+H-v/mx*H;d.line((L,y,L+W,y),fill='#DAE2E5',width=2);txt(L-18,y,f'{v:g}',23,'rm')
  d.line((L,T,L,T+H,L+W,T+H),fill='#173744',width=3)
 if typ=='heatmap':
  for j,h in enumerate(r['headers'][1:]):txt(450+j*270,200,h,28,'mm')
  for i,row in enumerate(rows):
   txt(180,300+i*145,row[0],30,'mm')
   for j,v in enumerate(row[1:]):
    x=320+j*270;y=240+i*145;g=int(240-v*10);d.rectangle((x,y,x+255,y+132),fill=(g,225-v*6,240-v*5),outline='white',width=3);txt(x+127,y+66,v,36,'mm')
  txt(60,925,'Cell values: minutes. Darker shading is higher time; read the exact printed values.',24)
 elif typ=='scatter':
  axis(14,7)
  for k in range(7):x=L+k/6*W;txt(x,T+H+40,k,24,'mm')
  for row in rows:
   x=L+row[1]/6*W;y=T+H-row[2]/14*H;d.ellipse((x-9,y-9,x+9,y+9),fill=C[0]);txt(x+16,y-18,f'{row[0]} ({row[1]},{row[2]})',23)
  txt(650,900,'Practice hours (x); tasks completed (y)',27)
 elif typ=='pie':
  a=-90
  for i,row in enumerate(rows):
   end=a+row[1]/100*360;col=['#146880','#A24726','#6654A1','#557727','#7A5567'][i];d.pieslice((130,200,810,880),a,end,fill=col,outline='white',width=3);mid=math.radians((a+end)/2);txt(470+235*math.cos(mid),540+235*math.sin(mid),str(row[1])+'%',30,'mm','white');d.rectangle((950,290+i*100,985,325+i*100),fill=col);txt(1005,288+i*100,f'{row[0]}: {row[1]}%',28);a=end
  txt(950,840,'Whole collection: 400 books',27)
 elif typ=='interval':
  # Horizontal scale explicitly starts at zero.
  for v in range(0,31,5):x=250+v/30*1150;d.line((x,220,x,820),fill='#DAE2E5',width=2);txt(x,860,v,25,'mm')
  for i,row in enumerate(rows):
   y=280+i*150;x=250+row[1]/30*1150;xx=250+row[2]/30*1150;txt(180,y,row[0],30,'mm');d.line((x,y,xx,y),fill=C[0],width=9)
   for p,v in [(x,row[1]),(xx,row[2])]:d.ellipse((p-10,y-10,p+10,y+10),fill=C[0]);txt(p,y-33,v,28,'mm')
  txt(600,920,'Feasible whole-number delivery (L); both endpoints included',26)
 elif typ=='paired':
  # Separate panels prevent unlike units sharing an axis.
  for j in range(1,4):
   l=65+(j-1)*510;mx=math.ceil(max(row[j] for row in rows)/5)*5
   txt(l+245,195,r['headers'][j],27,'mm')
   for k in range(6):
    v=mx*k/5;y=800-v/mx*500;d.line((l+60,y,l+480,y),fill='#DAE2E5',width=2);txt(l+50,y,f'{v:g}',20,'rm')
   for i,row in enumerate(rows):
    x=l+100+i*78;y=800-row[j]/mx*500;d.rectangle((x-25,y,x+25,800),fill=C[j-1]);txt(x,y-23,row[j],25,'mm');txt(x,840,row[0],25,'mm')
  txt(60,930,'Each panel has its own zero-based scale and unit. Projects are indivisible.',25)
 elif typ=='waterfall':
  axis(120,6);level=0
  for i,row in enumerate(rows):
   x=L+(i+.5)*W/len(rows)
   if i in (0,len(rows)-1):lo,hi=0,row[1];level=row[1];label=str(row[1])
   else:old=level;level+=row[1];lo,hi=min(old,level),max(old,level);label=f'{row[1]:+d}'
   yt=T+H-hi/120*H;yb=T+H-lo/120*H;d.rectangle((x-65,yt,x+65,yb),fill=C[0] if i in(0,5) else C[1] if row[1]<0 else C[2]);txt(x,yt-25,label,27,'mm');txt(x,850,row[0],24,'mm')
   if i<5:d.line((x+65,T+H-level/120*H,x+W/len(rows)-65,T+H-level/120*H),fill='#485D67',width=2)
  txt(60,930,'Units: badges. First/last bars are levels; intervening bars are signed changes.',24)
 elif typ in ('line','cumulative'):
  mx=160 if typ=='line' else 40;axis(mx,8 if typ=='line' else 4)
  for j in range(1,len(r['headers'])):
   pts=[(L+i*W/(len(rows)-1),T+H-row[j]/mx*H) for i,row in enumerate(rows)];d.line(pts,fill=C[j-1],width=5)
   for i,(x,y) in enumerate(pts):
    if j==1:d.ellipse((x-8,y-8,x+8,y+8),fill=C[0])
    else:d.rectangle((x-8,y-8,x+8,y+8),fill=C[1])
    txt(x,y+(-25 if j==1 else 28),rows[i][j],24,'mm',C[j-1])
   txt(220+(j-1)*650,925,r['headers'][j]+(' (circle)' if j==1 else' (square)'),25,c=C[j-1])
  for i,row in enumerate(rows):txt(L+i*W/(len(rows)-1),850,row[0],25,'mm')
 else:
  mx=15 if typ=='histogram' else 35;axis(mx,3 if typ=='histogram' else 7)
  for i,row in enumerate(rows):
   wid=W/len(rows);x=L+i*wid;vals=row[1:];base=0
   for j,v in enumerate(vals):
    y=T+H-(base+v)/mx*H;yb=T+H-base/mx*H;gap=0 if typ=='histogram' else 35;d.rectangle((x+gap,y,x+wid-gap,yb),fill=C[j],outline='white',width=2);txt(x+wid/2,(y+yb)/2,v,27,'mm','white');base+=v
   txt(x+wid/2,850,row[0],24,'mm')
  if typ=='histogram':txt(160,925,'Duration (seconds); vertical axis: number of parcels',25)
  else:
   for j,h in enumerate(r['headers'][1:]):txt(160+j*430,925,h,25,c=C[j])
 p=B/'references/assets'/('f07-'+r['referenceId'].replace('f07-data-','')+'.png');im.save(p);return p

def main():
 refs=[];assets=[]
 for r in json.loads((R/'scripts/family07-chart-data.json').read_text(encoding='utf-8-sig')):
  p=render(r);aid=r['referenceId'].replace('f07-data-','f07-')+'-chart';desc='Exact plotted data. Columns: '+'; '.join(r['headers'])+'. Rows: '+'; '.join(', '.join(map(str,row)) for row in r['rows'])+'.'
  refs.append({k:r[k] for k in ['referenceId','version','family','module','language','title','provenance']});refs[-1]['blocks']=[{'type':'text','text':r['note']},{'type':'image','assetId':aid,'caption':r['title'],'alt':r['title']+'; exact values follow in the accessible description.','description':desc}]
  assets.append({'assetId':aid,'path':p.relative_to(B).as_posix(),'mediaType':'image/png','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':1600,'height':1000,'provenance':r['provenance']})
 for name,x in [('analytical-data',refs),('analytical-chart-assets',assets)]: (B/'references'/f'{name}.json').write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('Rendered',len(assets),'original PNG charts and matching references/metadata.')
if __name__=='__main__':main()

