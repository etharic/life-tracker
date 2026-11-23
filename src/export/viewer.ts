import { FEELINGS } from '../domain/feelings';
import { CATEGORY_LABEL, type DayEntry, type MonthRecord, type YearRecord } from '../domain/types';
import { monthFolder } from '../format/paths';

/**
 * viewer.html: one self-contained page that shows the journal in any browser, offline, with no
 * app. The data is embedded (browsers do not let a local page read the files next to it);
 * photos and recordings are linked by relative path, so they show when the page sits at the
 * top of the Journal folder.
 */
export function viewerHtml(input: {
  days: DayEntry[];
  months: MonthRecord[];
  years: YearRecord[];
  note: string;
  generated: string;
}): string {
  const data = {
    generated: input.generated,
    note: input.note,
    feelings: FEELINGS.map((f) => ({ s: f.score, n: f.name, c: f.color, o: f.on })),
    days: input.days
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => ({
        d: d.date,
        t: d.title,
        f: d.feeling,
        w: d.writing,
        m: d.media.map((m) => ({ k: m.kind, p: `${monthFolder(d.date.slice(0, 7))}/${m.path}` })),
      })),
    months: input.months
      .slice()
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map((m) => ({
        m: m.month,
        goals: m.setup
          ? Object.entries(m.setup.goals).map(
              ([c, v]) => `${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}: ${v.text}`,
            )
          : [],
        hobbies: m.setup
          ? Object.entries(m.setup.hobbies).map(
              ([c, v]) => `${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}: ${v.text}`,
            )
          : [],
        outlook: m.setup?.outlook ?? '',
        extreme: m.setup?.extremeThing ?? '',
        extremeDone: m.extremeDone,
        incident: m.extremeIncident,
        highlights: Object.keys(m.weeks)
          .sort()
          .map((w) => m.weeks[w].highlight)
          .filter(Boolean),
      })),
    years: input.years.filter((y) => y.defining).map((y) => ({ y: y.year, t: y.defining!.text })),
  };
  // `</` must not appear inside the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Journal</title>
<style>
:root{--paper:#F7F7F4;--ink:#15181C;--ink2:#55595F;--line:#E2E3DF;--accent:#2B4C7E;--wash:#E6ECF5}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 80px}h1{font-size:34px;margin:0 0 4px}h2{font-size:22px;margin:40px 0 8px}
.muted{color:var(--ink2)}.note{white-space:pre-wrap;background:var(--wash);border-radius:10px;padding:14px 16px;margin:24px 0}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}nav button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font:inherit;cursor:pointer}
nav button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.grid{display:grid;grid-template-columns:22px repeat(12,1fr);gap:3px;margin:16px 0}.grid div{height:14px;border-radius:3px}
.grid .h{height:auto;font-size:11px;text-align:center;color:var(--ink2)}.grid .e{border:1px dashed #CBC5BA}
.day{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.day h3{margin:0;font-size:17px}.sw{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:6px}
.w{white-space:pre-wrap;margin-top:8px}.media img{max-width:100%;border-radius:10px;margin-top:8px}.media audio{width:100%;margin-top:8px}
.month{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}ul{margin:4px 0;padding-left:20px}
</style></head><body><main>
<h1>Journal</h1><div class="muted" id="gen"></div><div id="note"></div>
<h2>Life timeline</h2><div id="timeline" class="muted"></div>
<nav id="years"></nav><div id="year"></div>
</main>
<script id="data" type="application/json">${json}</script>
<script>
const D=JSON.parse(document.getElementById('data').textContent);
const F=Object.fromEntries(D.feelings.map(f=>[f.s,f]));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
document.getElementById('gen').textContent='Exported '+D.generated;
if(D.note){document.getElementById('note').innerHTML='<div class="note">'+esc(D.note)+'</div>'}
document.getElementById('timeline').innerHTML=D.years.length?D.years.map(y=>'<div><b>'+y.y+'</b> · '+esc(y.t)+'</div>').join(''):'No Misogi Rituals yet.';
const years=[...new Set(D.days.map(d=>d.d.slice(0,4)).concat(D.months.map(m=>m.m.slice(0,4))))].sort().reverse();
const nav=document.getElementById('years');
function show(y){
  [...nav.children].forEach(b=>b.classList.toggle('on',b.textContent===y));
  const days=D.days.filter(d=>d.d.startsWith(y));const byDate=Object.fromEntries(days.map(d=>[d.d,d]));
  let g='<div class="grid"><div class="h"></div>'+MN.map(m=>'<div class="h">'+m[0]+'</div>').join('');
  for(let n=1;n<=31;n++){g+='<div class="h">'+(n%5===1?n:'')+'</div>';for(let m=1;m<=12;m++){const len=new Date(Date.UTC(+y,m,0)).getUTCDate();
    if(n>len){g+='<div></div>';continue}const k=y+'-'+String(m).padStart(2,'0')+'-'+String(n).padStart(2,'0');const d=byDate[k];
    g+=d&&d.f!=null?'<div title="'+k+': '+d.f+' '+esc(F[d.f].n)+'" style="background:'+F[d.f].c+'"></div>':'<div class="e" title="'+k+'"></div>'}}
  g+='</div>';
  let h='<h2>'+y+'</h2>'+g;
  for(let m=12;m>=1;m--){const id=y+'-'+String(m).padStart(2,'0');const mo=D.months.find(x=>x.m===id);const md=days.filter(d=>d.d.startsWith(id)).reverse();
    if(!mo&&!md.length)continue;h+='<h2>'+MN[m-1]+' '+y+'</h2>';
    if(mo){h+='<div class="month">';if(mo.goals.length)h+='<div><b>Goals</b><ul>'+mo.goals.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div><div><b>Hobbies</b><ul>'+mo.hobbies.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
      if(mo.outlook)h+='<p><b>Outlook.</b> '+esc(mo.outlook)+'</p>';if(mo.extreme)h+='<p><b>Kevin’s Rule.</b> '+esc(mo.extreme)+(mo.extremeDone===true?' (done)':mo.extremeDone===false?' (not done)':'')+'</p>';
      if(mo.incident)h+='<p><b>Extreme incident.</b> '+esc(mo.incident.title)+' ('+mo.incident.date+', '+mo.incident.mark+')</p>';
      if(mo.highlights.length)h+='<div><b>Weekly highlights</b><ul>'+mo.highlights.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';h+='</div>'}
    for(const d of md){const f=d.f!=null?F[d.f]:null;h+='<div class="day"><div class="muted">'+(f?'<span class="sw" style="background:'+f.c+'"></span>'+f.s+' · '+esc(f.n)+' · ':'')+d.d+'</div><h3>'+esc(d.t||'Untitled')+'</h3>';
      if(d.w)h+='<div class="w">'+esc(d.w)+'</div>';if(d.m.length)h+='<div class="media">'+d.m.map(x=>x.k==='photo'?'<img loading="lazy" src="'+esc(x.p)+'" alt="">':'<audio controls preload="none" src="'+esc(x.p)+'"></audio>').join('')+'</div>';h+='</div>'}}
  document.getElementById('year').innerHTML=h}
years.forEach(y=>{const b=document.createElement('button');b.textContent=y;b.onclick=()=>show(y);nav.appendChild(b)});
if(years.length)show(years[0]);
</script></body></html>
`;
}
