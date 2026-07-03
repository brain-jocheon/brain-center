/**
 * MT-PRIS HTML에서 템플릿 데이터를 추출해 JSON으로 저장하는 1회성 스크립트
 * (원본 HTML의 var 선언을 중괄호 균형으로 잘라 안전하게 평가)
 */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/mnt/user-data/uploads/MT-PRIS_통합_리포트.html', 'utf-8');

function extractVar(name) {
  const marker = 'var ' + name + '=';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error('not found: ' + name);
  const exprStart = start + marker.length;
  // 문자열/중괄호 균형 파싱
  let depth = 0, inStr = null, esc = false, end = -1;
  const open = html[exprStart];
  if (open === "'" || open === '"') {
    // 문자열 값 (TALENT_INTRO)
    for (let i = exprStart + 1; i < html.length; i++) {
      if (esc) { esc = false; continue; }
      if (html[i] === '\\') { esc = true; continue; }
      if (html[i] === open) { end = i + 1; break; }
    }
  } else {
    for (let i = exprStart; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "'" || ch === '"') { inStr = ch; continue; }
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
  }
  const expr = html.slice(exprStart, end);
  return vm.runInNewContext('(' + expr + ')');
}

// differenceText 안의 조합 해석 map 추출
function extractDifferenceMap() {
  const fnStart = html.indexOf('function differenceText');
  const mapMarker = 'var map=';
  const mapStart = html.indexOf(mapMarker, fnStart) + mapMarker.length;
  let depth = 0, inStr = null, esc = false, end = -1;
  for (let i = mapStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return vm.runInNewContext('(' + html.slice(mapStart, end) + ')');
}

const names = ['PRIS','MAIN','TRAIT_BRIEF','DEEP','REST','REST_ENERGY','PERFORMANCE','VIRTUE_DETAIL','TALENT_MAP','LEARNING','CAREER_DETAIL','CLOSING_QUOTES','TALENT_INTRO','TYPE_DEFAULTS'];
const out = {};
for (const n of names) {
  out[n] = extractVar(n);
  const size = JSON.stringify(out[n]).length;
  console.log(n.padEnd(14), typeof out[n] === 'string' ? 'string' : Object.keys(out[n]).length + ' keys', '(' + size + ' chars)');
}
out.DIFFERENCE_MAP = extractDifferenceMap();
console.log('DIFFERENCE_MAP', Object.keys(out.DIFFERENCE_MAP).length + ' keys');

fs.writeFileSync('/home/claude/brain-center/scripts/mtpris-raw.json', JSON.stringify(out, null, 1), 'utf-8');
console.log('saved.');
