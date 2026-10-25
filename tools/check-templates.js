/* 校验各类型录入模板的示例行本身能通过校验 */
const BASE = 'http://localhost:5178';

async function main() {
  const list = await (await fetch(BASE + '/api/schema')).json();
  for (const e of list.data) {
    const tpl = await (await fetch(`${BASE}/api/template/${e.entity}`)).json();
    const r = await fetch(`${BASE}/api/import/${e.entity}?mode=validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
      body: JSON.stringify({ text: tpl.data.csv }),
    }).then((x) => x.json());
    if (r.code !== 0) { console.log(e.entity, 'FAIL', r.message); continue; }
    const d = r.data;
    const detail = d.results.map((x) => (x.errors || []).map((y) => y.label + ':' + y.msg).join('|') || 'ok').join(' / ');
    console.log(`${e.entity.padEnd(12)} total=${d.total} valid=${d.valid} invalid=${d.invalid}  ${detail}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
