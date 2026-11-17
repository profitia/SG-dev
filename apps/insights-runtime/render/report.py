"""Deterministic v0.5 renderer. No provider access, calculation of Forecast or prose edits."""
import argparse, hashlib, json, re, time
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, NextPageTemplate
from pypdf import PdfReader

KEYS=['executive','statistical','events','macro','outlook','calendar','asphalt','procurement']
TITLES=['Najważniejsze wnioski','Brent, WTI i bitumen: notowania i prognozy historyczne','Co się wydarzyło i dlaczego','Istotne odczyty i wskaźniki rynku','Perspektywa rynku i scenariusze','Kalendarz i publikacje do potwierdzenia','Od ropy do bitumenu i asfaltu','Warunkowe wnioski zakupowe']
NAME='OIL_ASPHALT_MARKET_OUTLOOK_v0.5_PL'
def number(value):
    return 'brak danych' if value is None else f'{value:,.2f}'.replace(',',' ').replace('.',',') if isinstance(value,(int,float)) else str(value)
def local(value):
    return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Warsaw')).strftime('%d.%m.%Y, %H:%M %Z')
def checked_url(value):
    if not value or not re.match(r'^https?://[^\s<>"\x00-\x1f]+$',value): return None
    return value
def publisher_label(e):
    value=e.get('publisher') or e.get('provider')
    return str(value.get('name') or value.get('id') or 'Źródło') if isinstance(value,dict) else str(value or 'Źródło')
def render(bundle,narrative,receipt,out,font,bold=None):
    render_start=time.perf_counter_ns()
    assert bundle['schemaVersion']=='ReportEvidenceBundle/OilAsphalt/0.5'
    assert receipt.get('profileId')==bundle['profileId'] and receipt.get('status')=='completed', 'REAL_V05_GENERATION_REQUIRED'
    assert receipt.get('evidenceFingerprint')==bundle['fingerprint'], 'EXACT_GENERATED_EVIDENCE_REQUIRED'
    assert set(narrative)==set(KEYS) and bundle['admissionRef']
    out.mkdir(parents=True,exist_ok=True)
    assert not (out/(NAME+'.pdf')).exists(), 'IMMUTABLE_OUTPUT_ALREADY_EXISTS'
    pdfmetrics.registerFont(TTFont('OilSans',font));pdfmetrics.registerFont(TTFont('OilBold',bold or font))
    normal=ParagraphStyle('body',fontName='OilSans',fontSize=10.4,leading=14.1,spaceAfter=7,textColor=colors.HexColor('#263745'))
    small=ParagraphStyle('small',parent=normal,fontSize=8.5,leading=10.7,spaceAfter=3)
    note=ParagraphStyle('note',parent=small,fontSize=8.2,leading=10,spaceAfter=2)
    heading=ParagraphStyle('heading',parent=normal,fontName='OilBold',fontSize=12,leading=15,spaceBefore=8,spaceAfter=6,textColor=colors.HexColor('#164d59'))
    title=ParagraphStyle('title',parent=heading,fontSize=21,leading=25,spaceBefore=0,spaceAfter=7)
    ids={e['id']:e for e in bundle['evidence']}
    ids['FORECAST']={'publisher':'Forecast Core / Macrobond','title':'Zamrożony eksperyment historyczny; modele i sprawdzalność w aneksie','publishedAt':None,'materialDepth':'CANONICAL_FROZEN_D0','url':None}
    ids['METHODOLOGY']={'publisher':'SpendGuru - profil ewaluacji v0.5','title':'Brak danych o regionie, ofertach i umowie nabywcy. TE Calendar wyłączony decyzją właściciela; wymagany przegląd człowieka.','publishedAt':None,'materialDepth':'PILOT_LIMITATIONS','url':None}
    assigned={};page_notes=[[] for _ in range(4)];html_rows={};md_rows={}
    def reference(ref,page):
        assert ref in ids, 'UNVERIFIED_CITATION'
        if ref not in assigned:assigned[ref]=len(assigned)+1;page_notes[page].append(ref)
        n=assigned[ref];return f'<super><link href="#source_{n}" color="#16556a">{n}</link></super>'
    for i,key in enumerate(KEYS):
        html_rows[key]=[];md_rows[key]=[]
        for statement in narrative[key]:
            text=statement['text'];assert not re.search(r'\d|\bEV\d+\b|https?://',text), 'MODEL_NUMERICAL_CLAIM'
            assert statement['refs']
            citations='<super>,</super>'.join(reference(ref,i//2) for ref in statement['refs'])
            html_rows[key].append(Paragraph(escape(text)+citations,normal))
            md_rows[key].append(text+''.join(f'[^{assigned[r]}]' for r in statement['refs']))
    for ref,page in [('CI_STOCKS',1),('CI_REFINERY',1),('CI_SUPPLIED',1),('CI_POSITION',2)]:
        if ref in ids: reference(ref,page)
    current=[e for e in bundle['evidence'] if e['family']=='market-observations' and e.get('facts',{}).get('price') is not None]
    price_rows=[['Instrument i rynek','Notowanie / jednostka','Czas obserwacji','Zmiana zamknięć (7 dni)']]
    for e in current:
        p=e['facts'];change=p.get('weeklyChange');delta='brak porównywalnych danych' if not change else number(change['percent'])+'% ('+change['from'][:10]+' - '+change['to'][:10]+')'
        price_rows.append([f"{(p.get('label') or p['symbol'])} / {p['symbol']} / {p['instrumentType']} / {p.get('referenceMarket','rynek niepotwierdzony')}",number(p['price'])+' '+(p.get('unit') or 'jednostka niepotwierdzona')+' ('+(p.get('currency') or 'waluta niepotwierdzona')+')',(p.get('observationDisplay') or p['observationAt']),delta])
    if len(price_rows)==1:price_rows.append(['Aktualne instrumenty TE','brak dopuszczonego odczytu','brak danych','nie obliczano'])
    commodity_rows=[['USA - wskaźnik','Odczyt / okres','Zmiana tygodniowa']]
    short_labels={'CI01':'Ropa komercyjna bez SPR','CI02':'Zapasy destylatów','CI03':'Wykorzystanie rafinerii','CI04':'Przerób ropy','CI05':'Product Supplied: benzyna','CI06':'Product Supplied: destylaty'}
    for ref in ['CI_STOCKS','CI_REFINERY','CI_SUPPLIED']:
        for row in ids.get(ref,{}).get('facts',{}).get('rows',[]):
            percent=row['unit']=='%'
            val=number(row['value'])+'%' if percent else f"{row['value']/1000:,.3f}".replace(',',' ').replace('.',',')+(' mln bbl' if row['unit']=='MBBL' else ' mln bbl/d')
            change=(f"{row['weeklyChange']:+.1f}".replace('.',',')+' pkt proc.') if percent else f"{row['weeklyChange']/1000:+.3f}".replace('.',',')+(' mln bbl' if row['unit']=='MBBL' else ' mln bbl/d')
            commodity_rows.append([short_labels[row['id']],val+' / '+row.get('period','okres w źródle'),change])
    cot=ids.get('CI_POSITION',{}).get('facts',{}).get('rows',[None])[0]
    integer=lambda v:f'{v:,}'.replace(',',' ')
    positioning='Brak dopuszczonego, porównywalnego odczytu pozycjonowania CFTC.'
    if cot:
        positioning='WTI - kontrakty terminowe bez opcji, pozycje '+cot['positionDate']+' wobec '+cot['previousPositionDate']+': Managed Money netto '+integer(cot['managedMoneyNet'])+' kontraktów (zmiana '+integer(cot['netChange'])+'); Open Interest '+integer(cot['openInterest'])+'. Data publikacji: '+str(cot.get('publicationAt','niepotwierdzona'))+'.'
    forecast=bundle['forecast'];series=forecast.get('series',[])
    historical='Brak dopuszczonej aktualnej prognozy Forecast Core na kolejny tydzień. Nie wyliczano nowych modeli ani przedziałów.'
    if series:
        historical='Forecast Core: start '+series[0]['models'][0]['origin']+', cel '+series[0]['models'][0]['target']+'. Pełne wyniki, sprawdzalność i ograniczenia w aneksie. Status: '+forecast.get('status','UNKNOWN')+'.'
    windows=bundle['windows'];lead='Asfalt drogowy | ewaluacja wewnętrzna - PARTIAL | stan wiedzy: '+local(bundle['asOf'])
    window='Przegląd '+windows['review']['fromDate']+' - '+windows['review']['throughDate']+' (tylko do granicy wiedzy). Perspektywa '+windows['outlook']['fromDate']+' - '+windows['outlook']['throughDate']+'.'
    md=['# Oil & Asphalt Market Outlook',lead,window,'Status eksperymentalny. Wymagany przegląd człowieka przed wykorzystaniem zewnętrznym.']
    for i,key in enumerate(KEYS):
        md.extend(['','## '+str(i+1)+'. '+TITLES[i],*md_rows[key]])
        if i==1:
            md+=['Notowania to ostatnie wartości TE; zmiany dotyczą odrębnej historii zamknięć. CFD to kontrakt różnicowy. CNY/t oznacza juany za tonę; nie jest to polska cena zakupu asfaltu.', ' | '.join(price_rows[0]),' | '.join(['---']*4),*[' | '.join(row) for row in price_rows[1:]],historical]
        if i==3: md+=[' | '.join(commodity_rows[0]),' | '.join(['---']*3),*[' | '.join(row) for row in commodity_rows[1:]],'EIA: tygodnie referencyjne. bbl - baryłka; bbl/d - baryłki dziennie. SPR - strategiczna rezerwa ropy USA. Daty publikacji niepotwierdzone.']
        if i==4: md.append(positioning)
    body_characters=len('\n'.join(md))
    def footnote(ref):
        e=ids[ref];n=assigned[ref];url=checked_url(e.get('url'));depth=e.get('materialDepth','UNKNOWN')
        kind='; tytuł/fragment, pełny tekst niezweryfikowany' if depth in ['SNIPPET','TITLE_ONLY','TITLE_DESCRIPTION','TITLE_DESCRIPTION_METADATA','PUBLISHED_SUMMARY','UNKNOWN'] else ''
        date=(e.get('publishedAt') or e.get('facts',{}).get('observationAt') or '')[:10]
        label=f"{n}. {publisher_label(e)}, {e.get('title') or e.get('sourceRecordRef') or ''} {date}{kind}"
        return label,url
    for ref,n in assigned.items():
        label,url=footnote(ref);md.append(f'[^{n}]: {label}'+(f' [{url}]({url})' if url else ''))
    # Continuous pagination preserves the original narrative instead of forcing
    # every pair of sections into one fixed-height page.
    w=A4[0]-88
    pdf=out/(NAME+'.pdf')
    doc=BaseDocTemplate(str(pdf),invariant=1,pagesize=A4,leftMargin=44,rightMargin=44,topMargin=40,bottomMargin=44,title='Oil & Asphalt Market Outlook v0.5',author='SpendGuru / Procurement Insights')
    def footer(canvas,document):
        canvas.saveState();canvas.setStrokeColor(colors.HexColor('#c4d5db'));canvas.line(44,40,A4[0]-44,40)
        canvas.setFont('OilSans',8);canvas.setFillColor(colors.HexColor('#4f6370'));canvas.drawString(44,24,'SpendGuru | ewaluacja wewnętrzna - wymagana ocena człowieka');canvas.drawRightString(A4[0]-44,24,f'{document.page}/4');canvas.restoreState()
    doc.addPageTemplates([PageTemplate(id='flow',frames=[Frame(44,48,w,A4[1]-92,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=footer)])
    flow=[Paragraph('Oil & Asphalt Market Outlook',title),Paragraph(escape(lead),small),Paragraph(escape(window),small),Paragraph('Wydanie eksperymentalne. Region, ekspozycja i formuła kontraktu nabywcy nie zostały określone.',small)]
    section_starts=[]
    for i,key in enumerate(KEYS):
        section_starts.append(len(flow))
        flow.append(Paragraph(f'{i+1}. '+escape(TITLES[i]),heading));flow.extend(html_rows[key])
        if i==1:
            table=Table([[Paragraph(escape(v),small) for v in row] for row in price_rows],colWidths=[w*.29,w*.25,w*.23,w*.23],repeatRows=1)
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9f0f2')),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
            flow.extend([table,Spacer(1,6),Paragraph('Notowania to ostatnie wartości TE; zmiany dotyczą odrębnej historii zamknięć. CFD to kontrakt różnicowy. CNY/t oznacza juany za tonę; nie jest to polska cena zakupu asfaltu.',small),Paragraph(escape(historical),small)])
        if i==3:
            table=Table([[Paragraph(escape(v),small) for v in row] for row in commodity_rows],colWidths=[w*.43,w*.30,w*.27],repeatRows=1)
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9f0f2')),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
            flow.extend([table,Spacer(1,5),Paragraph('EIA: tygodnie referencyjne. bbl - baryłka; bbl/d - baryłki dziennie. SPR - strategiczna rezerwa ropy USA. Daty publikacji niepotwierdzone.',small)])
        if i==4: flow.append(Paragraph(escape(positioning),small))
    flow.append(Paragraph('Przypisy źródłowe',heading))
    for ref,n in assigned.items():
        e=ids[ref];url=checked_url(e.get('url'));date=(e.get('publishedAt') or e.get('facts',{}).get('observationAt') or '')[:10]
        label=f"{n}. {publisher_label(e)}"+(f", {date}" if date else '')
        flow.append(Paragraph(f'<a name="source_{n}"/>'+escape(label)+(f' <link href="{escape(url)}" color="#16556a">Źródło</link>' if url else '')+'; pełny opis i ograniczenia w aneksie.',note))
    # Preserve the original four section-pair pages when every pair fits.
    # Otherwise continuous flow accommodates the full narrative without cuts.
    boundaries=[0]+[section_starts[i] for i in (2,4,6)]+[len(flow)]
    available=A4[1]-92
    heights=[sum(p.wrap(w,available)[1]+p.getSpaceBefore()+p.getSpaceAfter() for p in flow[a:b]) for a,b in zip(boundaries,boundaries[1:])]
    if all(height<=available-12 for height in heights):
        for index in reversed(boundaries[1:-1]): flow.insert(index,PageBreak())
    pdf_build_start=time.perf_counter_ns();doc.build(flow);pdf_build_ms=(time.perf_counter_ns()-pdf_build_start)/1e6;reader=PdfReader(str(pdf));assert len(reader.pages)==4,'FOUR_READABLE_PAGES_REQUIRED'
    assert all(abs(float(p.mediabox.width)-A4[0])<1 and abs(float(p.mediabox.height)-A4[1])<1 for p in reader.pages)
    text='\n'.join(p.extract_text() or '' for p in reader.pages);assert not re.search(r'\bEV\d+\b',text),'RAW_INTERNAL_CITATION'
    (out/(NAME+'.md')).write_text('\n\n'.join(md)+'\n')
    appendix=['# Aneks: dane, prognozy i pochodzenie','Stan wiedzy: '+bundle['asOf'],'TE Calendar świadomie wyłączony: obecna subskrypcja go nie obejmuje.','## Aktualne dodatkowe dane TE',json.dumps(current,ensure_ascii=False,indent=2),'## Forecast Core - odniesienie historyczne',historical]
    appendix+=['## Historyczne obserwacje TE - odrębne od najnowszego notowania',json.dumps(bundle.get('marketEvidenceHistory',[]),ensure_ascii=False,indent=2)]
    for s in series:
        appendix+=['### '+s['label']+' / '+s['seriesId'],'Model | Origin | Target | Punkt | n | MAE | RMSE | sMAPE','--- | --- | --- | --- | --- | --- | --- | ---']
        for m in s['models']:
            v=m['verification'];appendix.append(' | '.join([m['name'],m['origin'],m['target'],number(m['point']),str(v['sampleSize']),number(v['mae']),number(v['rmse']),number(v['smape'])]))
        appendix+=['Pełne wartości bez zaokrąglenia i ostatni zweryfikowany przypadek:',json.dumps(s,ensure_ascii=False,indent=2)]
    appendix+=['## Nowe wskaźniki EIA i CFTC',json.dumps([e for e in bundle['evidence'] if e['provider'] in ['eia','cftc']],ensure_ascii=False,indent=2),'## Kalendarz - kandydat niepublikowany jako potwierdzony termin',json.dumps(ids.get('CI_CALENDAR',{'facts':{'status':'NO_CONFIRMED_EVENTS'}})['facts'],ensure_ascii=False,indent=2)]
    appendix+=['## Prognozy Trading Economics - odrębne horyzonty',json.dumps([e for e in bundle['evidence'] if e['family']=='external-forecasts'],ensure_ascii=False,indent=2),'## Źródła i coverage',json.dumps(bundle['evidence'],ensure_ascii=False,indent=2),json.dumps(bundle.get('coverage',{}),ensure_ascii=False,indent=2),'## Odstępstwa i prawa',json.dumps(bundle['pilotDeviations'],ensure_ascii=False,indent=2),'Retencja surowych treści providerów: zero sekund. Metadane, dozwolone projekcje i parafrazy zgodnie z licencją; brak archiwum pełnych artykułów.','Fingerprint bundle: '+bundle['fingerprint']]
    (out/'ANEKS_DANYCH_FORECAST_I_ZRODEL.md').write_text('\n\n'.join(appendix)+'\n')
    result={'rendererTotalMs':(time.perf_counter_ns()-render_start)/1e6,'pdfBuildMs':pdf_build_ms,'status':'RENDERED_HUMAN_REVIEW_REQUIRED','pages':4,'pageSize':'A4','mainCharactersWithHeadingsAndTable':body_characters,'numberedFootnotes':len(assigned),'pdfSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'evidenceFingerprint':bundle['fingerprint'],'asOf':bundle['asOf'],'rawModelTextEdited':False,'originalNarrativePreserved':True,'reportNarrativeEditorialChanges':'NO_AUTOMATIC_EDITORIAL_CHANGES','visualReview':'REQUIRED'}
    (out/'RENDER_VALIDATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--bundle',required=True);p.add_argument('--narrative',required=True);p.add_argument('--receipt',required=True);p.add_argument('--output',required=True);p.add_argument('--font',required=True);p.add_argument('--bold');a=p.parse_args()
    render(json.loads(Path(a.bundle).read_text()),json.loads(Path(a.narrative).read_text()),json.loads(Path(a.receipt).read_text()),Path(a.output),a.font,a.bold)
