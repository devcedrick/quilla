"""Reproduce Family04 charts from unchanged canonical tables (Pillow only).

Run using the bundled Python runtime. Canonical data stays outside the bank's
answer-bearing reference inventory; learner image descriptions carry all values.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / 'content/question-bank/family-04'
DATA = json.loads((ROOT / 'scripts/family04-chart-data.json').read_text(encoding='utf-8'))
COLORS = ['#196A84', '#B55525', '#6654A2']
SELECTED = ['commute', 'test', 'scanners', 'bands', 'grid']


def font(size, bold=False):
    name = 'arialbd.ttf' if bold else 'arial.ttf'
    path = Path('C:/Windows/Fonts') / name
    return ImageFont.truetype(str(path) if path.exists() else 'DejaVuSans.ttf', size)


def render(reference):
    slug = reference['referenceId'].removeprefix('f04-data-')
    table = DATA[reference['referenceId']]
    rows = table['rows']
    im = Image.new('RGB', (1600, 1100), 'white')
    d = ImageDraw.Draw(im)
    d.text((60, 40), reference['title'], font=font(38, True), fill='#142E3D')
    d.text((60, 100), 'Original fictional data | Exact values labelled | See accompanying premises', font=font(24), fill='#405866')
    if slug == 'commute':
        d.text((620, 180), 'Destination', font=font(28, True), fill='#142E3D')
        d.text((80, 220), 'Origin', font=font(28, True), fill='#142E3D')
        for j, h in enumerate(table['headers'][1:]):
            d.text((550 + 300*j, 245), h, font=font(28, True), fill='#142E3D', anchor='mm')
        for i, row in enumerate(rows):
            d.text((340, 375+210*i), row[0], font=font(28), fill='#142E3D', anchor='rm')
            for j, val in enumerate(row[1:]):
                v=int(val)
                shade=tuple(round(a+(b-a)*v/24) for a,b in zip((233,244,248),(25,106,132)))
                x,y=400+300*j,280+210*i
                d.rectangle((x,y,x+290,y+190),fill=shade)
                d.text((x+145,y+95),val,font=font(42,True),fill='white' if v>15 else '#142E3D',anchor='mm')
        d.text((65, 1000), 'Cell labels: commuters. Darker cells indicate larger counts; numbers identify every value.', font=font(25), fill='#142E3D')
    elif slug == 'test':
        # Absolute stacked counts retain the unequal actual-condition denominators.
        left,right,top,bottom=300,1440,340,760
        for tick in range(5):
            v=tick*40;x=left+(right-left)*v/160
            d.line((x,top-35,x,bottom+30),fill='#D4DEE4',width=2)
            d.text((x,bottom+65),str(v),font=font(25),fill='#142E3D',anchor='mm')
        for i,row in enumerate(rows):
            y=420+250*i
            d.text((left-20,y),row[0],font=font(30,True),fill='#142E3D',anchor='rm')
            start=left
            for j,val in enumerate(row[1:]):
                end=start+int(val)/160*(right-left)
                d.rectangle((start,y-55,end,y+55),fill=COLORS[j])
                # The tiny segment uses an external callout instead of cramped text.
                if end-start<50:
                    d.line(((start+end)/2,y-55,(start+end)/2,y-100),fill=COLORS[j],width=3)
                    d.text(((start+end)/2,y-125),val,font=font(28,True),fill='#142E3D',anchor='mm')
                else:
                    d.text(((start+end)/2,y),val,font=font(30,True),fill='white',anchor='mm')
                start=end
        d.text((730,920),'Number of tiles (zero-based axis)',font=font(26),fill='#142E3D',anchor='mm')
        for j,h in enumerate(table['headers'][1:]):
            x=350+j*600
            d.rectangle((x,210,x+35,245),fill=COLORS[j]);d.text((x+50,225),h,font=font(26),fill='#142E3D',anchor='lm')
    elif slug == 'scanners':
        specs=[('Pages scanned',400),('Downtime (minutes)',25),('Pages per whole batch',50)]
        for j,(label,axismax) in enumerate(specs):
            x0=100+j*500;left=x0+55;right=x0+390;top,bottom=340,820
            d.text((x0,205),label,font=font(26,True),fill='#142E3D')
            for tick in range(6):
                v=axismax*tick/5;y=bottom-v/axismax*(bottom-top)
                d.line((left,y,right,y),fill='#D4DEE4',width=2)
                d.text((left-10,y),f'{v:g}',font=font(21),fill='#142E3D',anchor='rm')
            for i,row in enumerate(rows):
                x=left+40+i*110;v=int(row[j+1]);y=bottom-v/axismax*(bottom-top)
                d.rectangle((x-30,y,x+30,bottom),fill=COLORS[j])
                d.text((x,y-25),str(v),font=font(25,True),fill='#142E3D',anchor='mm')
                d.text((x,bottom+40),row[0],font=font(26),fill='#142E3D',anchor='mm')
        d.text((70,1000),'Scanner P / Q / R | Independent zero-based panel scales; units shown in panel titles.',font=font(25),fill='#142E3D')
    elif slug == 'bands':
        left,right,top,bottom=200,1400,260,850
        for tick in range(7):
            v=2*tick;y=bottom-v/12*(bottom-top)
            d.line((left,y,right,y),fill='#D4DEE4',width=2)
            d.text((left-25,y),str(v),font=font(24),fill='#142E3D',anchor='rm')
        for i,row in enumerate(rows):
            x=left+i*300;y=bottom-int(row[1])/12*(bottom-top)
            d.rectangle((x,y,x+300,bottom),fill=COLORS[0],outline='white',width=3)
            d.text((x+150,y-30),row[1],font=font(30,True),fill='#142E3D',anchor='mm')
            d.text((x+150,bottom+45),row[0].replace(' inclusive',''),font=font(26),fill='#142E3D',anchor='mm')
        d.text((65,180),'Number of tasks',font=font(27,True),fill='#142E3D')
        d.text((800,960),'Whole-minute duration (inclusive intervals)',font=font(28),fill='#142E3D',anchor='mm')
        d.text((65,1030),'Equal-width bins; individual task times within each bin are unknown.',font=font(25),fill='#142E3D')
    elif slug == 'grid':
        left,top,unit=230,240,120;bottom=top+6*unit
        for n in range(8):
            x=left+n*unit;d.line((x,top,x,bottom),fill='#D4DEE4',width=2)
            d.text((x,bottom+30),str(n),font=font(23),fill='#142E3D',anchor='mm')
        for n in range(7):
            y=bottom-n*unit;d.line((left,y,left+7*unit,y),fill='#D4DEE4',width=2)
            d.text((left-25,y),str(n),font=font(23),fill='#142E3D',anchor='rm')
        for row in rows:
            x=left+int(row[1])*unit;y=bottom-int(row[2])*unit
            if row[3]=='Yes':d.ellipse((x-12,y-12,x+12,y+12),fill=COLORS[0])
            else:d.rectangle((x-12,y-12,x+12,y+12),fill='white',outline=COLORS[1],width=4)
            d.text((x+23,y-26),f'{row[0]} ({row[1]}, {row[2]})',font=font(25,True),fill='#142E3D')
        d.text((left+400,1040),'East coordinate (blocks)',font=font(27),fill='#142E3D',anchor='mm')
        d.text((60,175),'North coordinate (blocks)',font=font(27),fill='#142E3D')
        d.ellipse((1235,370,1259,394),fill=COLORS[0]);d.text((1280,380),'Ramp: Yes',font=font(25),fill='#142E3D',anchor='lm')
        d.rectangle((1235,440,1259,464),fill='white',outline=COLORS[1],width=4);d.text((1280,450),'Ramp: No',font=font(25),fill='#142E3D',anchor='lm')
    target=BANK/'references/assets'/f'f04-{slug}.png'
    target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
    return target


if __name__ == '__main__':
    refs=json.loads((BANK/'references/analytical-data.json').read_text(encoding='utf-8'))
    assets=[]
    for ref in refs:
        slug=ref['referenceId'].removeprefix('f04-data-')
        if slug not in SELECTED:continue
        target=render(ref)
        table=DATA[ref['referenceId']]
        description=' '.join(row[0]+': '+'; '.join(h+' = '+v for h,v in zip(table['headers'][1:],row[1:]))+'.' for row in table['rows'])
        block={'type':'image','assetId':f'f04-{slug}-chart','caption':ref['title'],'alt':ref['title']+'. Exact labelled data are fully described below.','description':description}
        if ref['version']==1:
            ref['version']=2
            ref['blocks']=[block if b['type']=='table' else b for b in ref['blocks']]
        assets.append({'assetId':block['assetId'],'path':target.relative_to(BANK).as_posix(),'mediaType':'image/png','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'width':1600,'height':1100,'provenance':ref['provenance']})
    (BANK/'references/analytical-data.json').write_text(json.dumps(refs,indent=2)+'\n',encoding='utf-8')
    (BANK/'references/assets/metadata.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
    qp=BANK/'content/analytical-data.json';questions=json.loads(qp.read_text(encoding='utf-8'))
    changed={r['referenceId'] for r in refs if r['version']==2}
    for q in questions:
        if q['reference']['referenceId'] in changed and q['reference']['referenceVersion']==1:
            q['version']+=1;q['reference']['referenceVersion']=2
    qp.write_text(json.dumps(questions,indent=2)+'\n',encoding='utf-8')
    mp=BANK/'manifest.json';manifest=json.loads(mp.read_text(encoding='utf-8'));manifest['revision']=2
    manifest['sources'][0]['assetFiles']=['references/assets/metadata.json']
    mp.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(f'Rendered {len(assets)} charts; {sum(q["reference"]["referenceId"] in changed for q in questions)} questions pin reference v2.')

