const STORAGE_KEY = "pinaster-overtime-v1";
const SESSION_KEY = "pinaster-worker-session";

const seed = {
  workers: [
    { id:"w1", name:"Juan Pérez", role:"Operario de mantenimiento", pin:"1234", active:true },
    { id:"w2", name:"María López", role:"Encargada de obra", pin:"1234", active:true },
    { id:"w3", name:"Carlos Rodríguez", role:"Operario de zonas verdes", pin:"1234", active:true },
    { id:"w4", name:"Lucía Fernández", role:"Técnica de jardinería", pin:"1234", active:true }
  ],
  sites: [
    { id:"s1", name:"Mantenimiento de zonas verdes", manager:"Ana Torres" },
    { id:"s2", name:"Obra de jardinería", manager:"Roberto Gil" },
    { id:"s3", name:"Instalación de riego", manager:"Roberto Gil" },
    { id:"s4", name:"Campos deportivos", manager:"Ana Torres" }
  ],
  records: [
    rec("r1","w1","2026-11-03","17:30","19:30",0,"s1","Mantenimiento extraordinario de zona verde","aprobado","cronometro"),
    rec("r2","w2","2026-11-04","18:00","20:30",15,"s2","Finalización de obra de jardinería antes de lluvias","pendiente","cronometro"),
    rec("r3","w3","2026-11-02","16:00","19:00",30,"s4","Actuación urgente en césped deportivo","aprobado","cronometro"),
    rec("r4","w4","2026-11-05","07:00","08:30",0,"s3","Revisión de instalación de riego","pendiente","manual","Olvidé iniciar el contador"),
    rec("r5","w1","2026-11-05","18:00","21:00",30,"s2","Reparación de maquinaria de jardinería","pendiente","cronometro"),
    rec("r6","w3","2026-11-04","17:00","18:00",0,"s1","Limpieza y acondicionamiento de finca","rechazado","manual"),
    rec("r7","w2","2026-11-02","17:00","19:45",15,"s2","Recepción de planta y control de material","aprobado","cronometro"),
    rec("r8","w4","2026-11-03","16:30","18:30",0,"s4","Tratamiento y revisión fitosanitaria","aprobado","cronometro")
  ],
  sessions: []
};

function rec(id,workerId,date,start,end,breakMin,siteId,reason,status,source,notes=""){
  return { id,workerId,date,start,end,breakMin,siteId,reason,status,source,notes,
    history:[
      { at: date+"T"+end+":00", by:"Sistema PINASTER", action:"Registro enviado" },
      ...(status==="aprobado" ? [{at:date+"T21:10:00",by:"Ana Torres",action:"Aprobado"}] : []),
      ...(status==="rechazado" ? [{at:date+"T19:15:00",by:"Roberto Gil",action:"Rechazado: no autorizado previamente"}] : [])
    ]
  };
}

function clone(v){ return JSON.parse(JSON.stringify(v)); }
let state = load();

function load(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || clone(seed); }
  catch { return clone(seed); }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function resetState(){ state=clone(seed); save(); render(); toast("Datos demo restaurados"); }

function toMinutes(t){
  if(!t) return 0;
  const [h,m]=t.split(":").map(Number);
  return h*60+m;
}
function netMinutes(r){
  let d=toMinutes(r.end)-toMinutes(r.start);
  if(d<=0) d+=1440;
  return Math.max(0,d-(Number(r.breakMin)||0));
}
function fmtMinutes(min){
  const h=Math.floor(min/60), m=min%60;
  return m ? `${h} h ${String(m).padStart(2,"0")} min` : `${h} h`;
}
function fmtDate(iso){
  const [y,m,d]=iso.split("-");
  return `${d}/${m}/${y}`;
}
function today(){
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
function hhmm(d=new Date()){
  return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
function worker(id){ return state.workers.find(x=>x.id===id); }
function site(id){ return state.sites.find(x=>x.id===id); }
function route(path){ history.pushState({}, "", path); render(); }
window.addEventListener("popstate", render);

const tree = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 5 16 26h10L13 43h14v15h10V43h14L38 26h10L32 5Z" fill="currentColor"/></svg>`;

function appShell(content, mode="home"){
  return `<div class="shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">${tree}</span><span class="brand-copy"><span class="brand-name">PINASTER</span><small>MEDIO AMBIENTE</small></span></div>
      <div class="switch">
        <button class="${mode==="worker"?"active":""}" data-route="/trabajador">Trabajador</button>
        <button class="${mode==="admin"?"active":""}" data-route="/admin">Empresa</button>
      </div>
    </header>
    <main class="container">${content}</main>
  </div>`;
}

function home(){
  return appShell(`
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">PINASTER MEDIO AMBIENTE · Gestión interna</div>
        <h1>Imputación de<br>horas extras</h1>
        <p>Una herramienta interna inspirada en la identidad de Pinaster: natural, directa y profesional. El trabajador registra sus horas en segundos y la empresa mantiene todo ordenado y trazable.</p>
        <div class="hero-actions">
          <button class="btn primary" data-route="/trabajador">Entrar como trabajador</button>
          <button class="btn secondary" data-route="/admin">Abrir panel empresa</button>
        </div>
      </div>
      <div class="hero-art">
        <svg class="forest" viewBox="0 0 360 320" aria-hidden="true">
          <g fill="rgba(255,255,255,.92)">
            <path d="M180 18 128 92h30l-48 72h43l-57 85h62v55h44v-55h62l-57-85h43l-48-72h30L180 18Z"/>
            <path opacity=".45" d="M78 82 45 132h19l-31 49h27l-37 56h39v45h32v-45h38l-36-56h27l-31-49h19L78 82Zm205 35-27 40h16l-25 39h22l-30 45h31v40h27v-40h31l-30-45h22l-25-39h16l-28-40Z"/>
          </g>
        </svg>
      </div>
    </section>`, "home");
}

function currentWorkerId(){ return sessionStorage.getItem(SESSION_KEY); }
function setWorkerSession(id){ sessionStorage.setItem(SESSION_KEY,id); }
function clearWorkerSession(){ sessionStorage.removeItem(SESSION_KEY); }

function workerLogin(){
  return appShell(`<div class="worker-wrap">
    <div class="phone-card">
      <div class="page-head"><div><div class="eyebrow" style="color:var(--green)">Acceso trabajador</div><h1>Registrar horas extra</h1><p>Selecciona tu nombre e introduce tu PIN.</p></div></div>
      <form id="login-form" class="form-grid">
        <div class="field full"><label>Trabajador</label><select class="input" name="workerId" required>
          <option value="">Selecciona…</option>
          ${state.workers.filter(w=>w.active).map(w=>`<option value="${w.id}">${w.name} · ${w.role}</option>`).join("")}
        </select></div>
        <div class="field full"><label>PIN de acceso</label><input class="input" name="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required></div>
        <div class="field full"><button class="btn green" style="width:100%">Entrar</button></div>
      </form>
      <p class="muted" style="font-size:.82rem;margin-bottom:0">Demo: el PIN de todos los trabajadores es <b>1234</b>.</p>
    </div>
  </div>`, "worker");
}

function workerDashboard(w){
  const mine=state.records.filter(r=>r.workerId===w.id && r.date.startsWith("2026-11"));
  const total=mine.reduce((a,r)=>a+netMinutes(r),0);
  const approved=mine.filter(r=>r.status==="aprobado").reduce((a,r)=>a+netMinutes(r),0);
  const pending=mine.filter(r=>r.status==="pendiente").reduce((a,r)=>a+netMinutes(r),0);
  const session=state.sessions.find(s=>s.workerId===w.id);
  const recent=[...mine].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return appShell(`<div class="worker-wrap">
    <div class="phone-card">
      <div class="worker-head">
        <div><div class="muted">Buenas tardes,</div><h1 style="margin:.15rem 0 0">${w.name.split(" ")[0]}</h1><small class="muted">${w.role}</small></div>
        <div style="display:flex;gap:8px;align-items:center"><span class="avatar">${initials(w.name)}</span><button class="mini" id="logout-worker">Salir</button></div>
      </div>
      <div class="summary"><div class="eyebrow">Noviembre 2026</div><strong>${fmtMinutes(total)}</strong><div>horas extra registradas</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><div><small>Aprobadas</small><b style="display:block">${fmtMinutes(approved)}</b></div><div><small>Pendientes</small><b style="display:block">${fmtMinutes(pending)}</b></div></div>
      </div>
      ${session ? activeTimer(session) : `<button class="start-btn" id="start-overtime">▶ Iniciar horas extra<div style="font-size:.75rem;font-weight:600;opacity:.68;margin-top:5px">Pulsa cuando empieces fuera de horario</div></button>`}
      <div class="worker-links">
        <button class="link-card" data-route="/trabajador/manual">＋ Añadir registro manual</button>
        <button class="link-card" data-route="/trabajador/historial">◷ Mi historial</button>
      </div>
      <h3 style="margin:24px 0 10px">Últimos registros</h3>
      ${recordList(recent)}
    </div>
  </div>`, "worker");
}

function activeTimer(s){
  return `<div class="timer-box"><div style="color:#a36d19;font-weight:850">● Horas extra en curso</div><div class="timer" id="live-timer" data-start="${s.startedAt}">00:00:00</div><div class="muted">Inicio: <b>${hhmm(new Date(s.startedAt))}</b></div>
  <button class="stop-btn" id="finish-overtime" style="margin-top:15px">■ Finalizar horas extra</button>
  <button class="mini" id="cancel-overtime" style="margin-top:8px">Cancelar sin guardar</button></div>`;
}

function initials(name){ return name.split(" ").slice(0,2).map(x=>x[0]).join(""); }

function statusBadge(s){
  const map={pendiente:["pending","Pendiente"],aprobado:["approved","Aprobado"],rechazado:["rejected","Rechazado"]};
  return `<span class="status ${map[s][0]}">${map[s][1]}</span>`;
}

function recordList(list){
  if(!list.length) return `<div class="empty">Aún no hay registros.</div>`;
  return `<div class="list">${list.map(r=>`<div class="record">
    <div class="datebox">${r.date.slice(8)}<small>NOV</small></div>
    <div><b>${escapeHtml(r.reason)}</b><small>${r.start}–${r.end} · ${escapeHtml(site(r.siteId)?.name||"—")}</small></div>
    <div class="record-hours">${fmtMinutes(netMinutes(r))}<div style="margin-top:4px">${statusBadge(r.status)}</div></div>
  </div>`).join("")}</div>`;
}

function workerForm(w, manual){
  const session=state.sessions.find(s=>s.workerId===w.id);
  const start=(!manual && session) ? new Date(session.startedAt) : null;
  const values={date:today(),start:start?hhmm(start):"",end:manual?"":hhmm(),breakMin:0,siteId:"",reason:"",notes:""};
  return appShell(`<div class="worker-wrap"><div class="phone-card">
    <button class="back" data-route="/trabajador">← Volver</button>
    <div class="page-head"><div><h1>${manual?"Registro manual":"Finalizar horas extra"}</h1><p>${manual?"Añade un registro si olvidaste iniciar el contador.":"Revisa los datos y completa el trabajo realizado."}</p></div></div>
    ${overtimeForm(values, "worker-overtime-form")}
  </div></div>`, "worker");
}

function overtimeForm(v,id){
  return `<form id="${id}" class="form-grid">
    <div class="field full"><label>Fecha</label><input class="input calc-input" type="date" name="date" value="${v.date}" required></div>
    <div class="field"><label>Hora inicio</label><input class="input calc-input" type="time" name="start" value="${v.start}" required></div>
    <div class="field"><label>Hora fin</label><input class="input calc-input" type="time" name="end" value="${v.end}" required></div>
    <div class="field full"><label>Descanso (minutos)</label><input class="input calc-input" type="number" min="0" step="5" name="breakMin" value="${v.breakMin||0}"></div>
    <div class="field full"><label>Centro / obra</label><select class="input" name="siteId" required><option value="">Selecciona…</option>${state.sites.map(s=>`<option value="${s.id}" ${s.id===v.siteId?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select></div>
    <div class="field full"><label>Motivo o trabajo realizado</label><input class="input" name="reason" value="${escapeAttr(v.reason||"")}" placeholder="Ej. Reparación de maquinaria" required></div>
    <div class="field full"><label>Observaciones (opcional)</label><textarea class="input" name="notes">${escapeHtml(v.notes||"")}</textarea></div>
    <div class="field full"><div class="calc"><span>Horas extra netas</span><strong id="net-preview">0 h</strong></div></div>
    <div class="field full"><button class="btn green" style="width:100%">Enviar registro</button></div>
  </form>`;
}

function workerHistory(w){
  const list=[...state.records.filter(r=>r.workerId===w.id)].sort((a,b)=>b.date.localeCompare(a.date));
  return appShell(`<div class="worker-wrap"><div class="phone-card">
    <button class="back" data-route="/trabajador">← Volver</button>
    <div class="page-head"><div><h1>Mi historial</h1><p>Todos tus registros de horas extra.</p></div></div>
    ${recordList(list)}
  </div></div>`, "worker");
}

function adminLayout(content,active="registros"){
  const nav=[
    ["registros","/admin","Registros"],
    ["trabajadores","/admin/trabajadores","Trabajadores"],
    ["config","/admin/configuracion","Configuración"]
  ];
  return appShell(`<div class="layout-admin"><aside class="sidebar">
    ${nav.map(([id,path,label])=>`<button class="side-item ${active===id?"active":""}" data-route="${path}">${label}</button>`).join("")}
  </aside><section>${content}</section></div>`,"admin");
}

function adminDashboard(){
  const total=state.records.reduce((a,r)=>a+netMinutes(r),0);
  const pending=state.records.filter(r=>r.status==="pendiente");
  const approved=state.records.filter(r=>r.status==="aprobado").reduce((a,r)=>a+netMinutes(r),0);
  return adminLayout(`
    <div class="page-head"><div><div class="eyebrow" style="color:var(--green)">PINASTER MEDIO AMBIENTE · Empresa</div><h1>Horas extra</h1><p>Control, revisión y aprobación centralizada.</p></div>
      <div style="display:flex;gap:8px"><button class="btn ghost" id="export-csv">Exportar Excel</button><button class="btn green" id="print-pdf">Generar PDF</button></div>
    </div>
    <div class="grid4">
      <div class="kpi"><div class="label">Horas este mes</div><div class="value">${fmtMinutes(total)}</div></div>
      <div class="kpi"><div class="label">Registros pendientes</div><div class="value">${pending.length}</div></div>
      <div class="kpi"><div class="label">Horas aprobadas</div><div class="value">${fmtMinutes(approved)}</div></div>
      <div class="kpi"><div class="label">Trabajadores activos</div><div class="value">${state.workers.filter(w=>w.active).length}</div></div>
    </div>
    <div class="card" style="margin-top:18px">
      <h2 class="section-title">Registros de horas extra</h2>
      <div class="filters">
        <input class="input" id="filter-text" placeholder="Buscar trabajador o motivo">
        <select class="input" id="filter-status"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select>
        <select class="input" id="filter-worker"><option value="">Todos los trabajadores</option>${state.workers.map(w=>`<option value="${w.id}">${w.name}</option>`).join("")}</select>
        <select class="input" id="filter-site"><option value="">Todos los centros</option>${state.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}</select>
      </div>
      <div id="records-table">${adminTable(state.records)}</div>
    </div>`);
}

function adminTable(records){
  const sorted=[...records].sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Trabajador</th><th>Fecha</th><th>Horario</th><th>Descanso</th><th>Horas netas</th><th>Centro</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
    ${sorted.map(r=>`<tr>
      <td><b>${worker(r.workerId)?.name||"—"}</b></td><td>${fmtDate(r.date)}</td><td>${r.start}–${r.end}</td><td>${r.breakMin} min</td><td><b>${fmtMinutes(netMinutes(r))}</b></td><td>${escapeHtml(site(r.siteId)?.name||"—")}</td><td>${escapeHtml(r.reason)}</td><td>${statusBadge(r.status)}</td>
      <td><div class="row-actions"><button class="mini" data-detail="${r.id}">Ver</button><button class="mini ok" data-status="${r.id}:aprobado">✓</button><button class="mini bad" data-status="${r.id}:rechazado">×</button></div></td>
    </tr>`).join("")}
  </tbody></table></div>`;
}

function adminWorkers(){
  return adminLayout(`<div class="page-head"><div><h1>Trabajadores</h1><p>Acumulado mensual y estado de cada empleado.</p></div></div>
  <div class="card"><div class="table-wrap"><table class="table" style="min-width:760px"><thead><tr><th>Trabajador</th><th>Puesto</th><th>Registros</th><th>Pendiente</th><th>Aprobado</th><th>Total mes</th></tr></thead><tbody>
  ${state.workers.map(w=>{
    const list=state.records.filter(r=>r.workerId===w.id);
    const sum=s=>list.filter(r=>!s||r.status===s).reduce((a,r)=>a+netMinutes(r),0);
    return `<tr><td><b>${w.name}</b></td><td>${w.role}</td><td>${list.length}</td><td>${fmtMinutes(sum("pendiente"))}</td><td>${fmtMinutes(sum("aprobado"))}</td><td><b>${fmtMinutes(sum())}</b></td></tr>`;
  }).join("")}</tbody></table></div></div>`,"trabajadores");
}

function adminConfig(){
  return adminLayout(`<div class="page-head"><div><h1>Configuración</h1><p>Centros de trabajo y responsables.</p></div><button class="btn ghost" id="reset-demo">Restaurar demo</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    <div class="card"><h2 class="section-title">Centros / obras</h2><div class="list">${state.sites.map(s=>`<div class="record" style="grid-template-columns:1fr auto"><div><b>${escapeHtml(s.name)}</b><small>Responsable: ${escapeHtml(s.manager)}</small></div><button class="mini bad" data-remove-site="${s.id}">Eliminar</button></div>`).join("")}</div>
      <form id="site-form" class="form-grid" style="margin-top:14px"><div class="field full"><input class="input" name="name" placeholder="Nuevo centro u obra" required></div><div class="field full"><input class="input" name="manager" placeholder="Responsable" required></div><div class="field full"><button class="btn green">Añadir centro</button></div></form>
    </div>
    <div class="card"><h2 class="section-title">Cómo funciona</h2><p class="muted">El trabajador registra inicio y fin desde el móvil. El responsable revisa el registro en este panel y lo aprueba o rechaza. Los datos quedan guardados en este prototipo en el navegador.</p><p class="muted"><b>Siguiente fase:</b> conectar autenticación y base de datos para que todos los dispositivos compartan la misma información en tiempo real.</p></div>
  </div>`,"config");
}

function recordDetail(id){
  const r=state.records.find(x=>x.id===id); if(!r) return;
  const html=`<div class="modal-back" id="modal-back"><div class="modal">
    <div class="page-head"><div><h2>Detalle del registro</h2><p>${worker(r.workerId)?.name} · ${fmtDate(r.date)}</p></div>${statusBadge(r.status)}</div>
    <div class="calc"><span>Horas netas</span><strong>${fmtMinutes(netMinutes(r))}</strong></div>
    <div class="form-grid" style="margin-top:16px">
      <div class="field"><label>Horario</label><div>${r.start}–${r.end}</div></div>
      <div class="field"><label>Descanso</label><div>${r.breakMin} min</div></div>
      <div class="field"><label>Centro</label><div>${escapeHtml(site(r.siteId)?.name||"—")}</div></div>
      <div class="field"><label>Origen</label><div>${r.source==="manual"?"Manual":"Cronómetro"}</div></div>
      <div class="field full"><label>Motivo</label><div>${escapeHtml(r.reason)}</div></div>
      ${r.notes?`<div class="field full"><label>Observaciones</label><div>${escapeHtml(r.notes)}</div></div>`:""}
    </div>
    <h3>Trazabilidad</h3><div class="timeline">${r.history.map(h=>`<div><b>${escapeHtml(h.action)}</b><small>${escapeHtml(h.by)} · ${new Date(h.at).toLocaleString("es-ES")}</small></div>`).join("")}</div>
    <div style="display:flex;gap:8px;margin-top:20px"><button class="btn danger" style="flex:1" data-status="${r.id}:rechazado">Rechazar</button><button class="btn green" style="flex:1" data-status="${r.id}:aprobado">Aprobar</button></div>
  </div></div>`;
  document.body.insertAdjacentHTML("beforeend",html);
}

function setStatus(id,status){
  const r=state.records.find(x=>x.id===id); if(!r) return;
  r.status=status;
  r.history.push({at:new Date().toISOString(),by:"Responsable PINASTER",action:status==="aprobado"?"Aprobado":"Rechazado"});
  save();
  document.getElementById("modal-back")?.remove();
  render();
  toast(status==="aprobado"?"Registro aprobado":"Registro rechazado",status==="rechazado");
}

function filterAdmin(){
  const text=(document.getElementById("filter-text")?.value||"").toLowerCase();
  const status=document.getElementById("filter-status")?.value||"";
  const wid=document.getElementById("filter-worker")?.value||"";
  const sid=document.getElementById("filter-site")?.value||"";
  const list=state.records.filter(r=>{
    const hay=(worker(r.workerId)?.name+" "+r.reason).toLowerCase();
    return (!text||hay.includes(text))&&(!status||r.status===status)&&(!wid||r.workerId===wid)&&(!sid||r.siteId===sid);
  });
  const target=document.getElementById("records-table");
  if(target) target.innerHTML=adminTable(list);
}

function exportCsv(){
  const rows=[["Trabajador","Fecha","Inicio","Fin","Descanso","Horas netas","Centro","Motivo","Estado"],
    ...state.records.map(r=>[worker(r.workerId)?.name,r.date,r.start,r.end,r.breakMin,(netMinutes(r)/60).toFixed(2),site(r.siteId)?.name,r.reason,r.status])];
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(";")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="pinaster-horas-extra.csv"; a.click(); URL.revokeObjectURL(a.href);
  toast("Excel/CSV generado");
}

function submitWorkerForm(form,w,manual){
  const fd=new FormData(form);
  const r={
    id:"r"+Date.now(), workerId:w.id, date:fd.get("date"), start:fd.get("start"), end:fd.get("end"),
    breakMin:Number(fd.get("breakMin")||0), siteId:fd.get("siteId"), reason:String(fd.get("reason")||"").trim(),
    notes:String(fd.get("notes")||"").trim(), status:"pendiente", source:manual?"manual":"cronometro",
    history:[{at:new Date().toISOString(),by:w.name,action:manual?"Registro manual enviado":"Registro enviado desde cronómetro"}]
  };
  if(netMinutes(r)<=0){ toast("Revisa el horario indicado",true); return; }
  state.records.unshift(r);
  state.sessions=state.sessions.filter(s=>s.workerId!==w.id);
  save(); toast("Registro enviado");
  route("/trabajador");
}

function updatePreview(form){
  const fd=new FormData(form);
  const temp={start:fd.get("start"),end:fd.get("end"),breakMin:Number(fd.get("breakMin")||0)};
  const el=document.getElementById("net-preview"); if(el) el.textContent=fmtMinutes(netMinutes(temp));
}

function startTimerLoop(){
  const el=document.getElementById("live-timer"); if(!el) return;
  const tick=()=>{
    if(!document.body.contains(el)) return;
    const ms=Math.max(0,Date.now()-new Date(el.dataset.start).getTime());
    const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    el.textContent=[h,m,sec].map(n=>String(n).padStart(2,"0")).join(":");
    requestAnimationFrame(()=>setTimeout(tick,500));
  }; tick();
}

function bind(){
  document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>route(b.dataset.route));
  document.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>recordDetail(b.dataset.detail));
  document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{const [id,s]=b.dataset.status.split(":");setStatus(id,s)});
  document.querySelectorAll("#filter-text,#filter-status,#filter-worker,#filter-site").forEach(x=>x.addEventListener(x.tagName==="INPUT"?"input":"change",filterAdmin));

  const login=document.getElementById("login-form");
  if(login) login.onsubmit=e=>{e.preventDefault();const fd=new FormData(login);const w=worker(fd.get("workerId"));if(w&&w.pin===fd.get("pin")){setWorkerSession(w.id);route("/trabajador")}else toast("PIN incorrecto",true)};

  const logout=document.getElementById("logout-worker"); if(logout) logout.onclick=()=>{clearWorkerSession();render()};
  const start=document.getElementById("start-overtime"); if(start) start.onclick=()=>{const id=currentWorkerId();state.sessions=state.sessions.filter(s=>s.workerId!==id);state.sessions.push({workerId:id,startedAt:new Date().toISOString()});save();render();toast("Horas extra iniciadas")};
  const finish=document.getElementById("finish-overtime"); if(finish) finish.onclick=()=>route("/trabajador/finalizar");
  const cancel=document.getElementById("cancel-overtime"); if(cancel) cancel.onclick=()=>{state.sessions=state.sessions.filter(s=>s.workerId!==currentWorkerId());save();render();toast("Contador cancelado")};

  const wf=document.getElementById("worker-overtime-form");
  if(wf){const w=worker(currentWorkerId());const manual=location.pathname.endsWith("/manual");wf.onsubmit=e=>{e.preventDefault();submitWorkerForm(wf,w,manual)};wf.querySelectorAll(".calc-input").forEach(x=>x.addEventListener("input",()=>updatePreview(wf)));updatePreview(wf)}
  const sf=document.getElementById("site-form"); if(sf) sf.onsubmit=e=>{e.preventDefault();const fd=new FormData(sf);state.sites.push({id:"s"+Date.now(),name:String(fd.get("name")).trim(),manager:String(fd.get("manager")).trim()});save();render();toast("Centro añadido")};
  document.querySelectorAll("[data-remove-site]").forEach(b=>b.onclick=()=>{state.sites=state.sites.filter(s=>s.id!==b.dataset.removeSite);save();render();toast("Centro eliminado")});
  document.getElementById("reset-demo")?.addEventListener("click",resetState);
  document.getElementById("export-csv")?.addEventListener("click",exportCsv);
  document.getElementById("print-pdf")?.addEventListener("click",()=>window.print());
  document.getElementById("modal-back")?.addEventListener("click",e=>{if(e.target.id==="modal-back")e.currentTarget.remove()});
  startTimerLoop();
}

function render(){
  const root=document.getElementById("app");
  const p=location.pathname.replace(/\/$/,"")||"/";
  let html;
  if(p==="/") html=home();
  else if(p.startsWith("/trabajador")){
    const wid=currentWorkerId(), w=worker(wid);
    if(!w) html=workerLogin();
    else if(p==="/trabajador/manual") html=workerForm(w,true);
    else if(p==="/trabajador/finalizar") html=workerForm(w,false);
    else if(p==="/trabajador/historial") html=workerHistory(w);
    else html=workerDashboard(w);
  } else if(p==="/admin/trabajadores") html=adminWorkers();
  else if(p==="/admin/configuracion") html=adminConfig();
  else if(p.startsWith("/admin")) html=adminDashboard();
  else html=home();
  root.innerHTML=html; bind();
}
function toast(msg,bad=false){
  document.querySelector(".toast")?.remove();
  const el=document.createElement("div");el.className="toast"+(bad?" bad":"");el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2200);
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escapeAttr(v){return escapeHtml(v)}
render();
