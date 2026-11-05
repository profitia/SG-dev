"""Deterministic internal evaluator. No provider access or prose rewriting."""
import argparse, json, math, hashlib
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from pypdf import PdfReader

TITLES=['Executive Summary','Brent i WTI — ceny i Forecast D7','Wydarzenia i czynniki cenowe','Odczyty makroekonomiczne','Perspektywa kolejnego tygodnia','Kalendarz zaplanowanych publikacji','Mechanizm wpływu na bitum i asfalt','Procurement Outlook — decyzje warunkowe']
KEYS=['executive','statistical','events','macro','outlook','calendar','asphalt','procurement']

def number(v):
    return 'N/D' if v is None else f'{v:,.2f}'.replace(',',' ').replace('.',',') if isinstance(v,(int,float)) else str(v)

def compose(bundle,narrative):
    if set(narrative)!=set(KEYS): raise ValueError('EIGHT_SECTIONS_REQUIRED')
    refs={e['id'] for e in bundle['evidence']}|{'FORECAST'}
    by_id={e['id']:e for e in bundle['evidence']}
    def cite(ref):
        if ref=='FORECAST': return 'Forecast Core'
        e=by_id[ref];date=(e.get('publishedAt') or e.get('retrievedAt') or '')[:10]
        return (e.get('publisher') or e['provider'])+'; '+('publ. ' if e.get('publishedAt') else 'odczyt ')+date+'; '+ref
    bodies=[]
    for k in KEYS:
        rows=[]
        for s in narrative[k]:
            if not s['refs'] or any(r not in refs for r in s['refs']): raise ValueError('CITATION_NOT_IN_BUNDLE')
            if any(c.isdigit() for c in s['text']): raise ValueError('MODEL_NUMERICAL_CLAIM')
            rows.append(s['text']+' ['+'; '.join(cite(r) for r in s['refs'])+']')
        bodies.append(rows)
    price_rows=[['Futures / USD/bbl','Obserwacja i data','Zmiana 7D*','Punkty modeli D7**']]
    for s in bundle['forecast']['series']:
        previous=s.get('previous');gap=None if not s.get('previousDate') else __import__('datetime').date.fromisoformat(s['observationDate'])-__import__('datetime').date.fromisoformat(s['previousDate'])
        delta='N/D' if previous is None or not gap or gap.days!=7 else number(s['last']-previous)+' / '+(number((s['last']/previous-1)*100)+'%' if previous else 'N/D')
        points=[m['point'] for m in s['models']]
        price_rows.append([s['label'],number(s['last'])+' / '+s['observationDate'],delta,number(min(points))+' – '+number(max(points))])
    warn='* Zmiana od rzeczywistej obserwacji sprzed siedmiu dni. ** Min–max punktów modeli, nie przedział ufności. Forecast: EXPERIMENTAL_7D / PARTIAL_READY. Cel '+', '.join(sorted({m['target'] for s in bundle['forecast']['series'] for m in s['models']}))+'. D7 od obserwacji, nie od daty raportu. Brak zatwierdzonych przedziałów, rollover i certyfikacji point-in-time. Pełne wyniki i sprawdzalność w aneksie.'
    macro=[]
    for e in bundle['evidence']:
        f=e.get('facts') or {}
        if e['family']=='economic-calendar' and f.get('actual') is not None and e.get('eventAt') and e['eventAt']<=bundle['asOf']:
            macro.append(e.get('title','')+' / '+e['eventAt'][:10]+': Actual '+number(f.get('actual'))+'; konsensus '+number(f.get('consensusForecast'))+'; TE '+number(f.get('vendorForecast'))+'; poprzednio '+number(f.get('previous'))+'; rewizja '+number(f.get('revised'))+' '+(f.get('unit') or '')+' ['+e['id']+']')
    macro=macro[:3]
    calendar=[]
    for e in bundle['evidence']:
        if e['family']=='economic-calendar' and e.get('eventAt') and e['eventAt']>bundle['asOf']:
            f=e.get('facts',{})
            calendar.append(e['eventAt']+' | '+e.get('title','')+' | konsensus: '+number(f.get('consensusForecast'))+'; TE: '+number(f.get('vendorForecast'))+'; poprzednio: '+number(f.get('previous'))+' ['+e['id']+']')
    calendar=calendar[:5]
    if not calendar: calendar=['Brak potwierdzonych terminów w dopuszczonym materiale — luka kalendarza, bez domniemanych wyników.']
    headline='Oil & Asphalt Market Outlook'
    lead='Asfalt drogowy | ewaluacja wewnętrzna | asOf '+bundle['asOf']+' | '+bundle['windows']['timeZone']
    window='Okno: '+bundle['windows']['fromInclusive']+' — '+bundle['windows']['toExclusive']+'; '+bundle['windows']['mode']+'. Granica wiedzy: asOf.'
    md=['# '+headline,lead,window,'Status: HUMAN_REVIEW_REQUIRED. Region, ekspozycja i formuła cenowa nabywcy nie zostały określone.']
    for i,rows in enumerate(bodies):
        if i in (0,4): md+=['','## '+('Strona 1 — Market Review & Price Drivers' if i==0 else 'Strona 2 — Forward Outlook & Procurement Implications')]
        md+=['','### '+str(i+1)+'. '+TITLES[i],*rows]
        if i==1: md+=['',' | '.join(price_rows[0]),'--- | --- | ---',*[' | '.join(r) for r in price_rows[1:]],warn]
        if i==3: md+=macro
        if i==5: md+=calendar
    return headline,lead,window,bodies,price_rows,warn,calendar,macro,'\n\n'.join(md)+'\n'

def render(bundle,narrative,out,font_path,synthetic=False):
    out.mkdir(parents=True,exist_ok=True)
    if not synthetic and bundle.get('admissionRef') in (None,'SYNTHETIC_ONLY'): raise ValueError('LIVE_ADMISSION_REQUIRED')
    for name in ['OIL_ASPHALT_V04_REPORT.pdf','OIL_ASPHALT_V04_REPORT.md','OIL_ASPHALT_V04_FORECAST_SOURCES_ANNEX.md','RENDER_VALIDATION.json']:
        if (out/name).exists(): raise ValueError('IMMUTABLE_OUTPUT_EXISTS')
    pdfmetrics.registerFont(TTFont('OilSans',font_path))
    h,lead,window,bodies,prices,warn,calendar,macro,md=compose(bundle,narrative)
    title=('SYNTHETIC ONLY — '+h) if synthetic else h
    width=A4[0]-80; height=A4[1]-80
    selected=None
    for font_size in [10.4,10.1,9.8]:
        normal=ParagraphStyle('body',fontName='OilSans',fontSize=font_size,leading=font_size*1.27,spaceAfter=5)
        small=ParagraphStyle('small',parent=normal,fontSize=8,leading=10,spaceAfter=5,textColor=colors.HexColor('#45546a'))
        heading=ParagraphStyle('heading',parent=normal,fontSize=11,leading=14,spaceBefore=7,spaceAfter=5,textColor=colors.HexColor('#16405a'))
        top=ParagraphStyle('title',parent=normal,fontSize=18,leading=21,spaceAfter=7,textColor=colors.HexColor('#14374a'))
        pages=[]
        for page in range(2):
            content=[Paragraph(escape(title if page==0 else 'Forward Outlook & Procurement Implications'),top),Paragraph(escape(lead),small)]
            if page==0: content +=[Paragraph(escape(window),small),Paragraph('HUMAN_REVIEW_REQUIRED | Region, ekspozycja i formuła ceny nabywcy: nieokreślone.',small)]
            for i in range(page*4,page*4+4):
                content.append(Paragraph(escape(str(i+1)+'. '+TITLES[i]),heading))
                content.extend(Paragraph(escape(p),normal) for p in bodies[i])
                if i==1:
                    table=Table([[Paragraph(escape(v),small) for v in r] for r in prices],colWidths=[width*.19,width*.30,width*.23,width*.28])
                    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9f0f4')),('BOTTOMPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),3)]))
                    content.extend([table,Spacer(1,5),Paragraph(escape(warn),small)])
                if i==3: content.extend(Paragraph(escape(x),small) for x in macro)
                if i==5: content.extend(Paragraph(escape(x),small) for x in calendar)
            used=sum(f.wrap(width,height)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in content)
            pages.append(content)
        # Leave frame tolerance; never squeeze to unreadable type or clip overflow.
        if all(sum(f.wrap(width,height)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in content)<height-22 for content in pages): selected=pages;break
    if selected is None: raise ValueError('TWO_PAGE_LAYOUT_NEEDS_REVISION_NO_AUTO_REWRITE')
    pdf=out/'OIL_ASPHALT_V04_REPORT.pdf'
    def footer(canvas,doc):
        canvas.setFont('OilSans',8);canvas.setFillColor(colors.HexColor('#45546a'));canvas.drawString(40,25,'Ewaluacja wewnętrzna — wymagana akceptacja człowieka');canvas.drawRightString(A4[0]-40,25,str(doc.page)+'/2')
    SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=40,rightMargin=40,topMargin=40,bottomMargin=40,title=title,author='SpendGuru / Procurement Insights').build(selected[0]+[PageBreak()]+selected[1],onFirstPage=footer,onLaterPages=footer)
    reader=PdfReader(str(pdf));assert len(reader.pages)==2,'EXACTLY_TWO_PAGES_REQUIRED'
    assert all(abs(float(p.mediabox.width)-A4[0])<1 and abs(float(p.mediabox.height)-A4[1])<1 for p in reader.pages),'A4_REQUIRED'
    (out/'OIL_ASPHALT_V04_REPORT.md').write_text(md)
    annex=['# Aneks — Forecast i źródła','Kontekst: '+bundle['asOf'],warn]
    for s in bundle['forecast']['series']:
        annex +=['## '+s['label']+' / '+s['seriesId'],'Jednostka: '+s['unit']+'; provider: '+s['provider']+'; poprzednia obserwacja '+str(s.get('previousDate'))+' = '+number(s.get('previous')),'Model | origin | target | punkt | n | MAE | sMAPE | RMSE | sprawdzalność ostatniego przypadku','--- | --- | --- | --- | --- | --- | --- | --- | ---']
        for m in s['models']:
            v=m['verification'];last=v.get('lastCase') or {}
            annex.append(' | '.join([m['name'],m['origin'],m['target'],number(m['point']),str(v.get('sampleSize')),number(v.get('mae')),number(v.get('smape')),number(v.get('rmse')),number(last.get('verificationPercent'))]))
            annex.append('Ostatnia weryfikacja: '+json.dumps(last,ensure_ascii=False))
        # Deterministic diagram of actual available origin and eight independent
        # point forecasts; never fabricate a price history or interval ribbon.
        from PIL import Image, ImageDraw, ImageFont
        img=Image.new('RGB',(1120,480),'white');draw=ImageDraw.Draw(img)
        font=ImageFont.truetype(str(font_path),20);tiny=ImageFont.truetype(str(font_path),16)
        vals=[s['last']]+[m['point'] for m in s['models']];lo=min(vals);hi=max(vals);pad=max((hi-lo)*.25,.5);lo-=pad;hi+=pad
        y=lambda v: int(375-(v-lo)/(hi-lo)*280)
        draw.text((40,15),s['label']+' — niezależne punkty D7; bez przedziałów',font=font,fill='#14374a')
        draw.line((120,70,120,375,940,375),fill='#8c9aa3',width=2)
        for i in range(5):
            value=lo+(hi-lo)*i/4;yy=y(value);draw.line((120,yy,940,yy),fill='#e7edef');draw.text((10,yy-8),number(value),font=tiny,fill='#45546a')
        for m,col in zip(s['models'],['#155c83','#a85810','#32856d','#7b5398']):
            draw.line((170,y(s['last']),880,y(m['point'])),fill=col,width=3);yy=y(m['point']);draw.ellipse((874,yy-6,886,yy+6),fill=col)
        for i,(m,col) in enumerate(zip(s['models'],['#155c83','#a85810','#32856d','#7b5398'])):
            draw.text((120+i*240,435),m['name']+' '+number(m['point']),font=tiny,fill=col)
        draw.text((120,390),s['observationDate']+' / origin',font=tiny,fill='#45546a');draw.text((760,390),s['models'][0]['target']+' / target',font=tiny,fill='#45546a')
        chart=out/(s['seriesId']+'_D7.png');img.save(chart);annex+=['!['+s['label']+']('+chart.name+')',json.dumps({'models':s['models']},ensure_ascii=False,indent=2)]
    annex+=['## Bibliografia i pokrycie','Fingerprint bundle: '+bundle['fingerprint']]
    for e in bundle['evidence']: annex +=['### '+e['id']+' — '+e.get('title',''),json.dumps(e,ensure_ascii=False,indent=2)]
    annex +=['## Coverage',json.dumps(bundle['coverage'],ensure_ascii=False,indent=2)]
    (out/'OIL_ASPHALT_V04_FORECAST_SOURCES_ANNEX.md').write_text('\n\n'.join(annex)+'\n')
    result={'status':'RENDERED_NOT_PUBLICATION_APPROVED','syntheticOnly':synthetic,'pages':2,'pageSize':'A4','fontSize':font_size,'charactersMarkdown':len(md),'charactersVisibleApprox':len('\n'.join(p.extract_text() or '' for p in reader.pages)),'pdfSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'bundleFingerprint':bundle['fingerprint'],'asOf':bundle['asOf']}
    (out/'RENDER_VALIDATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--bundle',required=True);p.add_argument('--narrative',required=True);p.add_argument('--output',required=True);p.add_argument('--font',required=True);p.add_argument('--synthetic-only',action='store_true');a=p.parse_args()
    render(json.loads(Path(a.bundle).read_text()),json.loads(Path(a.narrative).read_text()),Path(a.output),a.font,a.synthetic_only)
