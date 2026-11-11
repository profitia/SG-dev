import json, os, re, subprocess, sys, zipfile, time, posixpath, contextlib
from pathlib import Path
import xml.etree.ElementTree as ET
import pymupdf
import olefile
from sandbox import isolate

VERSION = 'pk-passive-inventory-v1'
MAX_CHARS, MAX_UNITS = 2000000, 10000
NS = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p':'http://schemas.openxmlformats.org/presentationml/2006/main'}

def xml(data):
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('UNSAFE_DOCUMENT')
    return ET.fromstring(data)

def unit(kind, ordinal, text, status='COMPLETE', reason=None, derived=False):
    value = {'id':f'{kind.lower()}-{ordinal}', 'kind':kind,'ordinal':ordinal,'text':text,'status':status}
    if reason: value['reason'] = reason
    if derived: value['derivedLocation'] = True
    return value

def zip_safe(path):
    z = zipfile.ZipFile(path)
    entries = z.infolist()
    if len(entries)>10000 or sum(i.file_size for i in entries)>128*1024*1024:
        raise ValueError('UNSAFE_DOCUMENT')
    for i in entries:
        if i.flag_bits & 1 or i.file_size>32*1024*1024 or (i.file_size>1048576 and i.file_size/max(1,i.compress_size)>200):
            raise ValueError('UNSAFE_DOCUMENT')
        if i.filename.startswith('/') or '..' in Path(i.filename).parts or re.search(r'vbaproject|activex|embeddings/|customui/',i.filename,re.I):
            raise ValueError('UNSAFE_DOCUMENT')
        if i.filename.endswith('.rels'):
            if any(e.get('TargetMode')=='External' and re.search(r'vba|activex|oleobject|attachedtemplate',e.get('Type',''),re.I) for e in xml(z.read(i.filename))):
                raise ValueError('UNSAFE_DOCUMENT')
    return z

def text_nodes(e):
    out=[]
    for n in e.iter():
        if n.tag.endswith('}p') and out and not out[-1].endswith('\n'):out.append('\n')
        elif n.tag.endswith('}delText'):out.append('[DELETED_TEXT]'+(n.text or '')+'[/DELETED_TEXT]')
        elif n.tag.endswith('}t'): out.append(n.text or '')
        elif n.tag.endswith('}tab'): out.append('\t')
        elif n.tag.endswith('}br'): out.append('\n')
    return ''.join(out)

def word(path, derived=False):
    with zip_safe(path) as z:
        if 'word/document.xml' not in z.namelist(): raise ValueError('FORMAT_MISMATCH')
        body=xml(z.read('word/document.xml')).find('w:body',NS)
        if body is None: raise ValueError('FORMAT_MISMATCH')
        elements=list(body)
        # Inventory is taken before extraction. Every body block, header, footer,
        # foot/endnote is accounted; no invented Word page count.
        inventory=[]
        for child in elements:
            if child.tag.endswith('}sectPr'): continue
            inventory.append(('TABLE' if child.tag.endswith('}tbl') else 'PARAGRAPH',child))
        for name in sorted(z.namelist()):
            if re.match(r'word/(header\d+|footer\d+|footnotes|endnotes|comments)\.xml$',name):
                inventory.append(('PARAGRAPH',xml(z.read(name))))
        result=[]
        for index,(kind,e) in enumerate(inventory,1):
            if kind=='TABLE':
                rows=e.findall('w:tr',NS)
                content='[TABLE: JSON ROWS]\n'+'\n'.join(json.dumps([text_nodes(c) for c in row.findall('w:tc',NS)],ensure_ascii=False) for row in rows)
            else: content=text_nodes(e)
            drawings=len(e.findall('.//w:drawing',NS))+len(e.findall('.//w:object',NS))
            tracked=bool(e.findall('.//w:ins',NS)) or bool(e.findall('.//w:del',NS))
            merged=bool(e.findall('.//w:gridSpan',NS)) or bool(e.findall('.//w:vMerge',NS))
            partial=derived or drawings>0 or tracked or merged
            result.append(unit(kind,index,content,'PARTIAL' if partial else 'COMPLETE',
                'LEGACY_DERIVED_STRUCTURE' if derived else ('TRACKED_CHANGES' if tracked else ('COMPLEX_TABLE_STRUCTURE' if merged else ('VISUAL_CONTENT_NOT_INTERPRETED' if drawings else None))),derived))
        return result, {'nativeUnits':len(inventory),'nativeLocation':'DOCUMENT_BLOCK','legacyDerived':derived,'sourceInventoryVerified':not derived}

def slides(path, derived=False):
    with zip_safe(path) as z:
        if 'ppt/presentation.xml' not in z.namelist(): raise ValueError('FORMAT_MISMATCH')
        presentation=xml(z.read('ppt/presentation.xml'))
        ids=presentation.findall('p:sldIdLst/p:sldId',NS)
        rels={r.get('Id'):r.get('Target') for r in xml(z.read('ppt/_rels/presentation.xml.rels'))}
        result=[]
        for index,entry in enumerate(ids,1):
            rel=entry.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target=rels.get(rel,'')
            name=posixpath.normpath('ppt/'+target) if not target.startswith('/') else target[1:]
            if not name.startswith('ppt/slides/') or name not in z.namelist():
                result.append(unit('SLIDE',index,'','FAILED','MISSING_SLIDE'));continue
            slide=xml(z.read(name))
            content=[];shapes=[]
            def walk_shapes(parent):
                for child in parent:
                    if child.tag=='{'+NS['p']+'}grpSp':walk_shapes(child)
                    else:shapes.append(child)
            shape_tree=slide.find('p:cSld/p:spTree',NS)
            if shape_tree is not None:walk_shapes(shape_tree)
            for shape in shapes:
                table=shape.find('.//a:tbl',NS)
                if table is not None:
                    content.append('[TABLE: JSON ROWS]\n'+'\n'.join(json.dumps([text_nodes(cell) for cell in row.findall('a:tc',NS)],ensure_ascii=False) for row in table.findall('a:tr',NS)))
                else:
                    content.extend(text_nodes(p) for p in shape.findall('.//a:p',NS))
            content='\n'.join(content)
            visual=bool(slide.findall('.//p:pic',NS)) or bool(slide.findall('.//p:contentPart',NS)) or any(e.tag.endswith('}graphicData') and 'chart' in (e.get('uri') or '') for e in slide.iter())
            merged=any(any(c.get(k) not in [None,'0','1','false'] for k in ['gridSpan','rowSpan']) or c.get('hMerge') in ['1','true'] or c.get('vMerge') in ['1','true'] for c in slide.findall('.//a:tc',NS))
            # Notes numbering need not equal slide numbering. Resolve the actual
            # internal relationship; never silently drop notes on reordered slides.
            rel_name=posixpath.dirname(name)+'/_rels/'+posixpath.basename(name)+'.rels'
            notes_missing=False
            if rel_name in z.namelist():
                for relationship in xml(z.read(rel_name)):
                    if relationship.get('Type','').endswith('/notesSlide'):
                        target=relationship.get('Target','')
                        note=target[1:] if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(name),target))
                        if not note.startswith('ppt/notesSlides/') or note not in z.namelist():notes_missing=True;continue
                        notes=xml(z.read(note));content+='\n[NOTES]\n'+'\n'.join(text_nodes(p) for p in notes.findall('.//a:p',NS))
            result.append(unit('SLIDE',index,content,'PARTIAL' if derived or visual or notes_missing or merged else 'COMPLETE',
                'LEGACY_DERIVED_STRUCTURE' if derived else ('NOTES_MISSING' if notes_missing else ('COMPLEX_TABLE_STRUCTURE' if merged else ('VISUAL_CONTENT_NOT_INTERPRETED' if visual else None))),derived))
        return result, {'nativeUnits':len(ids),'nativeLocation':'SLIDE','legacyDerived':derived,'sourceInventoryVerified':not derived}

def pdf(path, job):
    doc=pymupdf.open(path)
    if doc.is_encrypted or doc.page_count>500 or doc.embfile_count(): raise ValueError('UNSAFE_DOCUMENT')
    for xref in range(1,doc.xref_length()):
        data=doc.xref_object(xref,compressed=True)
        if re.search(r'/(JavaScript|JS|Launch|RichMedia|XFA)\b',data): raise ValueError('UNSAFE_DOCUMENT')
    count=doc.page_count;result=[];deadline=time.monotonic()+80
    for index in range(count):
        if time.monotonic()>deadline:
            result.append(unit('PAGE',index+1,'','FAILED','EXTRACTION_TIME_BUDGET'));continue
        page=doc.load_page(index)
        try:
            text=page.get_text(sort=True);reason=None
            images=page.get_images()
            if len(text.strip())<24 and images:
                if page.rect.width*page.rect.height>2000000: raise ValueError('PAGE_RENDER_LIMIT')
                png=job/f'ocr-{index}.png';page.get_pixmap(matrix=pymupdf.Matrix(1.6,1.6)).save(png)
                completed=subprocess.run(['tesseract',str(png),'stdout','-l','pol+eng','--psm','3'],capture_output=True,timeout=25,check=True)
                text=completed.stdout.decode('utf8');reason='OCR_REQUIRES_VISUAL_FIDELITY_REVIEW'
            elif images or page.get_drawings(): reason='VISUAL_CONTENT_NOT_INTERPRETED'
            # Retain native text, then add an explicitly normalized row matrix.
            # No cell is replaced with zero; merged/unresolved cells remain null.
            tables=page.find_tables().tables
            for table_index,table in enumerate(tables,1):
                rows=table.extract()
                text+='\n[TABLE '+str(table_index)+': NORMALIZED JSON ROWS]\n'+'\n'.join(json.dumps(row,ensure_ascii=False) for row in rows)
                if any(cell is None for row in rows for cell in row):reason='COMPLEX_TABLE_STRUCTURE'
            result.append(unit('PAGE',index+1,text,'PARTIAL' if reason else 'COMPLETE',reason))
        except Exception:
            result.append(unit('PAGE',index+1,'','FAILED','PAGE_EXTRACTION_FAILED'))
    return result, {'nativeUnits':count,'nativeLocation':'PAGE'}

def extract(path, extension, job):
    magic=path.read_bytes()[:8]
    if extension=='.pdf':
        if not magic.startswith(b'%PDF-'): raise ValueError('FORMAT_MISMATCH')
        return pdf(path,job)
    if extension in ['.docx','.pptx']:
        if not magic.startswith(b'PK'): raise ValueError('FORMAT_MISMATCH')
        return word(path) if extension=='.docx' else slides(path)
    if extension in ['.doc','.ppt']:
        if magic!=bytes.fromhex('d0cf11e0a1b11e1'): raise ValueError('FORMAT_MISMATCH')
        with olefile.OleFileIO(path) as ole:
            names=['/'.join(n) for n in ole.listdir()]
            if any(re.search(r'vba|macros|objectpool|encryptedpackage',n,re.I) for n in names): raise ValueError('UNSAFE_DOCUMENT')
            if ('WordDocument' if extension=='.doc' else 'PowerPoint Document') not in names: raise ValueError('FORMAT_MISMATCH')
        # LO never sees a service credential and has no network or access to other
        # jobs. Disable all macro execution in its private per-job profile.
        profile=job/'lo-profile';(profile/'user').mkdir(parents=True,exist_ok=True)
        (profile/'user'/'registrymodifications.xcu').write_text('<oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>')
        target='docx' if extension=='.doc' else 'pptx'
        subprocess.run(['libreoffice',f'-env:UserInstallation={profile.as_uri()}','--headless','--nologo','--nodefault','--nolockcheck','--nofirststartwizard',
            '--convert-to',target,'--outdir',str(job),str(path)],capture_output=True,timeout=70,check=True)
        converted=job/(path.stem+'.'+target)
        if not converted.exists(): raise ValueError('LEGACY_CONVERSION_FAILED')
        return word(converted,True) if target=='docx' else slides(converted,True)
    if extension in ['.txt','.md','.markdown']:
        data=path.read_bytes()
        if b'\0' in data: raise ValueError('FORMAT_MISMATCH')
        text=data.decode('utf-8-sig',errors='strict').replace('\r\n','\n').replace('\r','\n')
        # Split only at explicit blank paragraph boundaries. Keep all characters.
        paragraphs=text.split('\n\n')
        return [unit('PARAGRAPH',i+1,t) for i,t in enumerate(paragraphs)],{'nativeUnits':len(paragraphs),'nativeLocation':'PARAGRAPH'}
    raise ValueError('UNSUPPORTED_FORMAT')

if __name__=='__main__':
    try:
        path=Path(sys.argv[1]).resolve();job=path.parent
        os.environ.clear();os.environ.update({'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(job),'TMPDIR':str(job),'LANG':'C.UTF-8',
            'SAL_USE_VCLPLUGIN':'svp','OMP_THREAD_LIMIT':'1','OPENBLAS_NUM_THREADS':'1'})
        isolate(str(job))
        if not path.is_file() or not 0<path.stat().st_size<=52428800: raise ValueError('FILE_LIMIT')
        with contextlib.redirect_stdout(sys.stderr):
            units,inventory=extract(path,sys.argv[2].lower(),job)
        if not units or len(units)>MAX_UNITS or sum(len(u['text']) for u in units)>MAX_CHARS: raise ValueError('EXTRACTED_TEXT_LIMIT')
        print(json.dumps({'parserVersion':VERSION,'inventory':inventory,'units':units},ensure_ascii=False))
    except Exception as error:
        code=str(error) if str(error) in ['PARSER_ISOLATION_UNAVAILABLE','UNSAFE_DOCUMENT','UNSUPPORTED_FORMAT','FORMAT_MISMATCH','FILE_LIMIT','EXTRACTED_TEXT_LIMIT','LEGACY_CONVERSION_FAILED'] else 'EXTRACTION_FAILED'
        print(json.dumps({'error':code}));sys.exit(1)
