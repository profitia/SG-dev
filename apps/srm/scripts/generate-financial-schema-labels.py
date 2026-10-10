#!/usr/bin/env python3
"""Regenerate the offline MF financial label registry from pinned official XSD files.
Usage: python3 scripts/generate-financial-schema-labels.py XSD_DIRECTORY OUTPUT_JSON
Only schema annotations are used, never financial documents, credentials or URLs from provider payloads.
No network or external entity resolution is performed. Source digests must match the pinned registry.
"""
import hashlib
import json
import pathlib
import sys
import xml.etree.ElementTree as ET

SOURCES = [{'family': 'JednostkaInna', 'revision': '1-0', 'filename': 'JednostkaInnaStrukturyDanychSprFin_v1-0.xsd', 'url': 'https://mf-arch2.mf.gov.pl/documents/764034/6464789/JednostkaInnaStrukturyDanychSprFin_v1-0.xsd', 'sha256': '80a98a5d78f4b13f84cf4d0e50b0f553f92128c43d4873730159d24b590095c6'}, {'family': 'JednostkaInna', 'revision': '1-2', 'filename': 'JednostkaInnaStrukturyDanychSprFin_v1-2.xsd', 'url': 'https://www.gov.pl/documents/2034621/2182793/JednostkaInnaStrukturyDanychSprFin_v1-2.xsd', 'sha256': '28fadb2d77b86a459b4a7c48734516357c6040a51c9d31b3569d04a30566557d'}, {'family': 'JednostkaInna', 'revision': '1-3', 'filename': 'JednostkaInnaStrukturyDanychSprFin_v1-3.xsd', 'url': 'https://www.gov.pl/static/finanse/SF/DefinicjeTypySprawozdaniaFinansowe/2024/10/24/JednostkaInnaStrukturyDanychSprFin_v1-3.xsd', 'sha256': '60b25f05e76407621ea28fadaa9811bf57c866eb5977b8a4f89c349cc63338ca'}, {'family': 'JednostkaInna', 'revision': '2-0E', 'filename': 'JednostkaInnaStrukturyDanychSprFin_v2-0E.xsd', 'url': 'https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2025/07/31/eD/JednostkaInnaStruktury/JednostkaInnaStrukturyDanychSprFin_v2-0E.xsd', 'sha256': 'a0077b666d9737670ac5dbdd3cb65083a9e27207bf6d1369a2e176562a4adee5'}, {'family': 'JednostkaMala', 'revision': '1-0', 'filename': 'JednostkaMalaStrukturyDanychSprFin_v1-0.xsd', 'url': 'https://mf-arch2.mf.gov.pl/documents/764034/6464789/JednostkaMalaStrukturyDanychSprFin_v1-0.xsd', 'sha256': '601bc7f2751da38f2bf7f797544de649455ff17be61d1f1f015df1e664b39348'}, {'family': 'JednostkaMala', 'revision': '1-2', 'filename': 'JednostkaMalaStrukturyDanychSprFin_v1-2.xsd', 'url': 'https://www.gov.pl/documents/2034621/2182793/JednostkaMalaStrukturyDanychSprFin_v1-2.xsd', 'sha256': 'ab144598f9fe4515ded3fdd10ef704807a3c12f6affd5bf48f2e965517a30a4a'}, {'family': 'JednostkaMala', 'revision': '1-3', 'filename': 'JednostkaMalaStrukturyDanychSprFin_v1-3.xsd', 'url': 'https://www.gov.pl/static/finanse/SF/DefinicjeTypySprawozdaniaFinansowe/2024/10/24/JednostkaMalaStrukturyDanychSprFin_v1-3.xsd', 'sha256': 'b298406d0d67db7866688b973b565b70dad355d6b3ee67ea23e80d2321a2a4cf'}, {'family': 'JednostkaMala', 'revision': '2-0E', 'filename': 'JednostkaMalaStrukturyDanychSprFin_v2-0E.xsd', 'url': 'https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2025/07/31/eD/JednostkaMalaStruktury/JednostkaMalaStrukturyDanychSprFin_v2-0E.xsd', 'sha256': 'a599651a7d5d324b95c6fd13d4c1d0531552064f623e3bad712bdf5e7e929da1'}, {'family': 'JednostkaMikro', 'revision': '1-0', 'filename': 'JednostkaMikroStrukturyDanychSprFin_v1-0.xsd', 'url': 'https://mf-arch2.mf.gov.pl/documents/764034/6464789/JednostkaMikroStrukturyDanychSprFin_v1-0.xsd', 'sha256': '8f0557983f502245c9787eb4ba108401cf7bbcb617e14c40abece7003623c440'}, {'family': 'JednostkaMikro', 'revision': '1-2', 'filename': 'JednostkaMikroStrukturyDanychSprFin_v1-2.xsd', 'url': 'https://www.gov.pl/documents/2034621/2182793/JednostkaMikroStrukturyDanychSprFin_v1-2.xsd', 'sha256': '2bf2d51dac06a6688f5f695736980c1c08985d37a0ce620d241e27f633d79dcf'}, {'family': 'JednostkaMikro', 'revision': '1-3', 'filename': 'JednostkaMikroStrukturyDanychSprFin_v1-3.xsd', 'url': 'https://www.gov.pl/static/finanse/SF/DefinicjeTypySprawozdaniaFinansowe/2024/10/24/JednostkaMikroStrukturyDanychSprFin_v1-3.xsd', 'sha256': 'a8d6ac5ea8284ce149f59fcf725a8ca040d9523ecd73bee485d993c284ab3498'}, {'family': 'JednostkaMikro', 'revision': '2-0E', 'filename': 'JednostkaMikroStrukturyDanychSprFin_v2-0E.xsd', 'url': 'https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2025/07/31/eD/JednostkaMikroStruktury/JednostkaMikroStrukturyDanychSprFin_v2-0E.xsd', 'sha256': '7fce74c846c53af8b978890fa5afb2f4bc10bca332be2c1411eecf28af2ad1b2'}, {'family': 'SkonsolidowanaJednostkaInna', 'revision': '1-0', 'filename': 'SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-0.xsd', 'url': 'https://mf-arch2.mf.gov.pl/documents/764034/6464789/SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-0.xsd', 'sha256': '13bd0d9df8e2a88e48b801289537d8bebe01e70ee1810bd6453a101c01c6ae23'}, {'family': 'SkonsolidowanaJednostkaInna', 'revision': '1-2', 'filename': 'SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-2.xsd', 'url': 'https://www.gov.pl/documents/2034621/2182793/SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-2.xsd', 'sha256': '53ffbbff3100cf1c6e8233320042ae205ad2ac82471e3ececd90b1c1a92cb911'}, {'family': 'SkonsolidowanaJednostkaInna', 'revision': '1-3', 'filename': 'SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-3.xsd', 'url': 'https://www.gov.pl/static/finanse/SF/DefinicjeTypySprawozdaniaFinansowe/2024/10/24/SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v1-3.xsd', 'sha256': 'c82efd8dd627e9160812c5cadc82389ebad6854f58a385f3d12ff210637933e2'}, {'family': 'SkonsolidowanaJednostkaInna', 'revision': '2-0E', 'filename': 'SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v2-0E.xsd', 'url': 'https://crd.gov.pl/xml/schematy/dziedzinowe/mf/2025/07/31/eD/SkonsolidowanaJednostkaInnaStruktury/SkonsolidowanaJednostkaInnaStrukturyDanychSprFin_v2-0E.xsd', 'sha256': 'a6f6e91f1db3fb5020f5f7fcbf2078dce0e6ebf54bcfbcffbb27444fd7683ca3'}]
NS = {"x": "http://www.w3.org/2001/XMLSchema"}

def children(node):
    for child in node:
        kind = child.tag.split("}")[-1]
        if kind == "element":
            yield child
        elif kind in ("sequence", "choice", "all", "complexType", "complexContent", "extension"):
            yield from children(child)

def labels(root, family, thousands):
    types = {node.get("name"): node for node in root.findall("x:complexType", NS)}
    result = []
    def walk(node, path):
        for element in children(node):
            name = element.get("name")
            if not name or name.startswith("Kwota") or name in ("NazwaPozycji", "Nazwa"):
                continue
            source_path = path + "." + name
            documentation = element.find("x:annotation/x:documentation", NS)
            label = " ".join("".join(documentation.itertext()).split()) if documentation is not None else None
            if label:
                result.append([source_path, label])
            walk(element, source_path)
    for section in ("Bilans", "RZiS"):
        key = ("Skonsolidowany" if family.startswith("Skonsolidowana") else "") + section + family.removeprefix("Skonsolidowana") + ("WTys" if thousands else "")
        walk(types[key], section)
    return result

def main():
    folder, output = map(pathlib.Path, sys.argv[1:])
    tables, schemas = {}, {}
    for source_index, source in enumerate(SOURCES):
        raw = (folder / source["filename"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source["sha256"] or b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
            raise ValueError("Unverified or unsafe schema: " + source["filename"])
        root = ET.fromstring(raw)
        for thousands in (False, True):
            rows = labels(root, source["family"], thousands)
            digest = hashlib.sha256(json.dumps(rows, ensure_ascii=False).encode()).hexdigest()[:16]
            tables[digest] = rows
            name = source["family"] + ("WTysiacachZlotych" if thousands else "WZlotych")
            revision = source["revision"]
            # Version is the XML header wrapper version; the current (2) wrappers import v2-0E types.
            versions = ["1-0", "1-1", "1-0E"] if revision == "1-0" else [revision] if revision in ("1-2", "1-3") else ["1-0E"]
            for version in versions:
                schemas[name + "|" + version + "|" + ("2" if revision == "2-0E" else "1")] = {"table": digest, "source": source_index}
    output.write_text(json.dumps({"sources": SOURCES, "schemas": schemas, "tables": tables}, ensure_ascii=False, indent=2) + "\n")

if __name__ == "__main__":
    main()
