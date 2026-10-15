import assert from "node:assert/strict";
import test from "node:test";
import { parseMsrOriginal, MsrParserError } from "./msr-parser";
import { decodeMsrOriginal } from "./msr-source";
function fixture(facts: string, extra = "") {
  const xml = '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"'
    + ' xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:f="https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full"'
    + ' xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12" xmlns:iso="http://www.xbrl.org/2003/iso4217"'
    + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><head/><body><ix:header><ix:resources>'
    + '<xbrli:context id="c"><xbrli:entity><xbrli:identifier scheme="urn:test">TEST_ENTITY</xbrli:identifier></xbrli:entity>'
    + '<xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period></xbrli:context>'
    + '<xbrli:unit id="u"><xbrli:measure>iso:PLN</xbrli:measure></xbrli:unit>'
    + extra + '</ix:resources></ix:header>' + facts + '</body></html>';
  return decodeMsrOriginal("68373e33935a5dc0776e1c56", Buffer.from(xml), "application/xhtml+xml", "2026-10-15T00:00:00Z");
}
const number = (value: string, attrs = "", name = "Revenue") =>
  '<ix:nonFraction name="f:' + name + '" contextRef="c" unitRef="u" ' + attrs + '>' + value + '</ix:nonFraction>';
test("MSR parser resolves namespaces, context, units, scale and source amounts without floating-point loss", () => {
  const p = parseMsrOriginal(fixture(number("1 873 436", 'format="ixt:num-comma-decimal" scale="3" decimals="-3"')));
  assert.equal(p.facts[0].amount, "1873436000"); assert.equal(p.facts[0].sourceAmount, "1873436");
  assert.equal(p.units[0].currency, "PLN"); assert.equal(p.contexts[0].from, "2024-01-01");
  assert.equal(p.facts[0].namespace, "https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full");
});
test("MSR parser preserves source signs, decimal precision and declared zero versus missing values", () => {
  const p = parseMsrOriginal(fixture(number("22 882", 'format="ixt:num-comma-decimal" scale="3" sign="-"')
    + number("7,29", 'format="ixt:num-comma-decimal"', "BasicEarningsLossPerShare")
    + number("—", 'format="ixt:fixed-zero"', "FinanceCosts")
    + number("", 'xsi:nil="true"', "IncomeTaxExpense")));
  assert.deepEqual(p.facts.map(f => f.amount), ["-22882000", "7.29", "0", null]);
  assert.equal(p.facts[3].validation, "REVIEW");
});
test("MSR parser respects ix:exclude, continuations and never executes report markup", () => {
  const p = parseMsrOriginal(fixture(number('123<ix:exclude>999</ix:exclude>', 'continuedAt="cont" format="ixt:num-comma-decimal"')
    + '<ix:continuation id="cont">4,50</ix:continuation>'));
  assert.equal(p.facts[0].amount, "1234.5"); assert.equal(p.facts[0].rawText, "1234,50");
});
test("MSR duplicate values stay traceable while conflicting values fail closed", () => {
  const ok = parseMsrOriginal(fixture(number("100") + number("100")));
  assert.equal(ok.facts.length, 2); assert.ok(ok.facts.every(f => f.validation === "VALID"));
  const conflict = parseMsrOriginal(fixture(number("100") + number("101")));
  assert.ok(conflict.facts.every(f => f.validation === "REVIEW" && f.reason === "CONFLICTING_FACTS"));
});
test("MSR unsupported numeric transformations are retained as REVIEW rather than invented facts", () => {
  const p = parseMsrOriginal(fixture(number("123", 'format="ixt:unsupported"')));
  assert.equal(p.facts[0].rawText, "123"); assert.equal(p.facts[0].amount, null);
  assert.equal(p.facts[0].reason, "UNSUPPORTED_TRANSFORMATION");
});
test("MSR parser rejects DTD, malformed XML, duplicate IDs and invalid continuation chains", () => {
  const original = fixture(number("1"));
  for (const xml of [
    original.files[0].text.replace("<html", '<!DOCTYPE x [<!ENTITY a SYSTEM "https://evil.example/">]><html'),
    original.files[0].text.replace("</body>", "</wrong>"),
    original.files[0].text.replace('id="u"', 'id="c"'),
    fixture(number("1", 'continuedAt="missing"')).files[0].text,
  ]) assert.throws(() => parseMsrOriginal({ ...original, files: [{ ...original.files[0], text: xml }] }), MsrParserError);
});
test("MSR parser never classifies untagged XHTML as structured financial data", () => {
  assert.throws(() => parseMsrOriginal(fixture("<table><tr><td>Revenue</td><td>100</td></tr></table>")),
    (e: unknown) => e instanceof MsrParserError && e.code === "MSR_NO_IXBRL_FACTS");
});

function positionedFixture() {
  const cell=(x:string,y:string,t:string)=>`<div class="c ${x} ${y}"><div class="t">${t}</div></div>`;
  const page=(title:string,section:string,rows:[string,string,string][])=>`<div class="pf" id="${section}"><div class="t">Jednostkowe sprawozdanie ${title}</div>`
    +cell("x1","y1","(w tys. PLN)")+cell("x2","y1",`${section==="pnl"?"12 MIESIĘCY ZAKOŃCZONY ":""}31.12.2025`)+cell("x3","y1",`${section==="pnl"?"12 MIESIĘCY ZAKOŃCZONY ":""}31.12.2024`)
    +rows.map(([label,a,b],i)=>cell("x1",`y${i+2}`,label)+cell("x2",`y${i+2}`,a)+cell("x3",`y${i+2}`,b)).join("")+"</div>";
  const xml='<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><body><p>NIP: 5272443955</p>'
    +page("z dochodów całkowitych","pnl",[["Przychody z działalności operacyjnej razem","1 200","1 000"],["Koszty działalności operacyjnej razem","(800)","(750)"],["Zysk z działalności operacyjnej","400","250"],["Zysk netto","200","150"]])
    +page("z sytuacji finansowej","balance",[["Aktywa razem","2 000","1 800"],["Zobowiązania razem","900","1 000"]])+"</body></html>";
  return decodeMsrOriginal("a".repeat(24),Buffer.from(xml),"application/xhtml+xml","2026-10-15");
}
const expected={nip:"5272443955",from:"2025-01-01",to:"2025-12-31",scope:"standalone" as const};
test("positioned XHTML reads only explicit primary cells with entity, scope, unit, dates and sign reconciliation",()=>{
  const p=parseMsrOriginal(positionedFixture(),expected);
  assert.equal(p.sourceType,"POSITIONED_XHTML");
  assert.equal(p.facts.find(f=>f.localName==="Revenue")?.amount,"1200000");
  assert.equal(p.facts.find(f=>f.localName==="ExpenseByNature")?.amount,"800000");
  assert.equal(p.facts.find(f=>f.localName==="ExpenseByNature")?.reason,"VERIFIED_SIGNED_OPERATING_EXPENSE");
  assert.ok(p.contexts.some(c=>c.to==="2024-12-31"));
  assert.ok(p.facts.every(f=>f.namespace.startsWith("urn:profitia:")));
});
test("positioned XHTML rejects identity/scope/date/unit mismatch and never resolves external entities",()=>{
  const original=positionedFixture();
  for(const identity of [{...expected,nip:"1111111111"},{...expected,scope:"consolidated" as const},{...expected,to:"2026-12-31"}]) assert.throws(()=>parseMsrOriginal(original,identity),MsrParserError);
  for(const [from,to] of [["(w tys. PLN)","(w tys. EUR)"],["31.12.2025","30.12.2025"],["<html",'<!ENTITY x SYSTEM "file:///etc/passwd"><html']]) {
    const bad={...original,files:original.files.map(f=>({...f,text:f.text.replaceAll(from,to)}))};
    assert.throws(()=>parseMsrOriginal(bad,expected),MsrParserError);
  }
});
test("unreconciled negative expenses and missing amounts remain REVIEW rather than fabricated costs",()=>{
  const original=positionedFixture();
  const bad={...original,files:original.files.map(f=>({...f,text:f.text.replace("(800)","(850)").replace(">200<",">—<")}))};
  const p=parseMsrOriginal(bad,expected);
  assert.equal(p.facts.find(f=>f.localName==="ExpenseByNature")?.validation,"REVIEW");
  assert.equal(p.facts.find(f=>f.localName==="ProfitLoss")?.amount,null);
  assert.equal(p.facts.find(f=>f.localName==="Revenue")?.validation,"VALID");
});
