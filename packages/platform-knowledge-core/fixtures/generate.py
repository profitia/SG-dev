"""Synthetic reference files, no provider calls or customer material.

Usage: python generate.py [output-directory] [--legacy-office | --verified-legacy]
LibreOffice regeneration performs a real round-trip. Normal CI reuses those
verified binaries with provenance, content and hash checks, without claiming
that it performed another Office conversion.
"""
from pathlib import Path
import io, json, sys, subprocess, hashlib, tempfile, zipfile
from reportlab.pdfgen import canvas
from docx import Document
from pptx import Presentation
from pptx.util import Inches
from pypdf import PdfReader
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader

out = Path(sys.argv[1]) if len(sys.argv)>1 and not sys.argv[1].startswith('--') else Path(__file__).parent/'files'
out.mkdir(parents=True,exist_ok=True)
marker='PK_REFERENCE CPV 30190000-7 ISO 9001:2015 DELIVERY 12 DAYS'
text=marker+'\nCommission A evaluates delivery. Reference brochure proposes 5 days.\n'
(out/'reference.txt').write_text(text,encoding='utf-8')
(out/'reference.md').write_text('# Delivery standard\n'+text+'\n| Supplier | Days |\n|---|---|\n| Alpha | 12 |\n| Beta | 18 |\n',encoding='utf-8')
c=canvas.Canvas(str(out/'reference.pdf'),invariant=1)
c.drawString(40,800,marker);c.drawString(40,775,'Commission A evaluates delivery.')
c.drawString(40,740,'Supplier | Days');c.drawString(40,720,'Alpha | 12');c.drawString(40,700,'Beta | 18')
c.drawString(40,650,'Chart: Alpha 12, Beta 18 days');c.rect(40,600,120,20,fill=1);c.rect(40,570,180,20,fill=1);c.save()
doc=Document();doc.add_heading('Delivery standard',0);doc.add_paragraph(marker);doc.add_paragraph('Commission A evaluates delivery.')
table=doc.add_table(rows=3,cols=2)
for row,values in zip(table.rows,[['Supplier','Days'],['Alpha','12'],['Beta','18']]):
    for cell,value in zip(row.cells,values):cell.text=value
doc.save(out/'reference.docx')
deck=Presentation();slide=deck.slides.add_slide(deck.slide_layouts[5]);slide.shapes.title.text='Delivery standard'
box=slide.shapes.add_textbox(Inches(.4),Inches(1.2),Inches(9),Inches(1));box.text_frame.text=marker
table=slide.shapes.add_table(3,2, Inches(.4), Inches(2.5), Inches(5), Inches(2)).table
for i,row in enumerate([['Supplier','Days'],['Alpha','12'],['Beta','18']]):
    for j,value in enumerate(row):table.cell(i,j).text=value
slide.notes_slide.notes_text_frame.text='Commission A evaluates delivery.'
deck.save(out/'reference.pptx')
c=canvas.Canvas(str(out/'long-100-pages.pdf'),invariant=1)
for page in range(1,101):
    c.drawString(40,800,f'PK_PAGE_{page:03d} Delivery knowledge section {page}')
    c.drawString(40,775,'The source manifest must account for this page.')
    if page==100:c.drawString(40,750,'PK_LAST_PAGE_MARKER_100')
    c.showPage()
c.save()
image=Image.new('RGB',(1400,800),'white');draw=ImageDraw.Draw(image)
draw.text((60,60),'PK_SCANNED_TABLE Supplier Alpha 12 days; Beta 18 days',fill='black',font_size=30)
c=canvas.Canvas(str(out/'scanned-table.pdf'),invariant=1);c.drawImage(ImageReader(image),40,400,width=520,height=300);c.save()
assert marker in PdfReader(out/'reference.pdf').pages[0].extract_text()
long=PdfReader(out/'long-100-pages.pdf');assert len(long.pages)==100
assert 'PK_LAST_PAGE_MARKER_100' in long.pages[99].extract_text()
assert not PdfReader(out/'scanned-table.pdf').pages[0].extract_text().strip()
assert marker in '\n'.join(p.text for p in Document(out/'reference.docx').paragraphs)
assert marker in '\n'.join(s.text for s in Presentation(out/'reference.pptx').slides[0].shapes if s.has_text_frame)
assert not ('--legacy-office' in sys.argv and '--verified-legacy' in sys.argv), 'Choose one legacy fixture mode'
legacy_reference_verified=False
legacy_provenance=None
if '--legacy-office' in sys.argv:
    with tempfile.TemporaryDirectory(prefix='pk-office-') as tmp:
        profile=Path(tmp)/'profile'
        def office(*args):
            subprocess.run(['libreoffice',f'-env:UserInstallation={profile.as_uri()}','--headless',*args],check=True,timeout=120,capture_output=True)
        office('--convert-to','doc:MS Word 97','--outdir',str(out),str(out/'reference.docx'))
        office('--convert-to','ppt:MS PowerPoint 97','--outdir',str(out),str(out/'reference.pptx'))
        for name in ['reference.doc','reference.ppt']:
            assert (out/name).read_bytes()[:8]==bytes.fromhex('d0cf11e0a1b11ae1')
            office('--convert-to','pdf','--outdir',tmp,str(out/name))
            extracted='\n'.join(p.extract_text() for p in PdfReader(Path(tmp)/'reference.pdf').pages)
            assert '30190000-7' in extracted and '12' in extracted
elif '--verified-legacy' in sys.argv:
    legacy=Path(__file__).parent/'legacy-office'
    legacy_provenance=json.loads((legacy/'provenance.json').read_text())
    assert legacy_provenance['roundTripVerified'] is True
    assert set(legacy_provenance['files'])=={'reference.doc','reference.ppt'}
    # A changed source document must regenerate the Office references; a valid
    # old binary alone does not prove that it represents the current content.
    for name,digest in legacy_provenance['sourceFiles'].items():
        assert hashlib.sha256((out/name).read_bytes()).hexdigest()==digest, 'Legacy fixture source changed: '+name
    for name,members in legacy_provenance['sourceXml'].items():
        with zipfile.ZipFile(out/name) as archive:
            for member,digest in members.items():
                assert hashlib.sha256(archive.read(member)).hexdigest()==digest, 'Legacy Office content changed: '+name+'/'+member
    for name,digest in legacy_provenance['files'].items():
        content=(legacy/name).read_bytes()
        assert content[:8]==bytes.fromhex('d0cf11e0a1b11ae1'), 'Invalid Office reference: '+name
        assert hashlib.sha256(content).hexdigest()==digest, 'Legacy fixture hash mismatch: '+name
        (out/name).write_bytes(content)
    legacy_reference_verified=True
if '--legacy-office' in sys.argv or legacy_reference_verified:
    (out/'reference.markdown').write_text((out/'reference.md').read_text(),encoding='utf-8')
print(json.dumps({'status':'PASS','synthetic':True,'legacyOfficeVerified':'--legacy-office' in sys.argv,
    'legacyReferenceVerified':legacy_reference_verified,'legacyReferenceRun':legacy_provenance['runId'] if legacy_provenance else None,
    'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.is_file()}},indent=2))
