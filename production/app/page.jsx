"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDb, technicalEmail } from "../lib/supabase";

const roleTitles={
 superadmin:"Superadministrador",operations_manager:"Coordinación", area_lead:"Responsable de área",
 supervisor:"Supervisión", executive:"Dirección",workshop:"Taller",
 availability:"Comercial",operations_reader:"Administración operativa",
 user_admin:"Gestión de usuarios",security_admin:"Administración de seguridad",
 worker:"Trabajador"
};
const tabs=[
 {id:"inicio",title:"Resumen",check:"all"},
 {id:"jornada",title:"Mi jornada",check:"all"},
 {id:"planificacion",title:"Planificación",check:"plan"},
 {id:"partes",title:"Partes de trabajo",check:"reports"},
 {id:"maquinaria",title:"Maquinaria",check:"machines"},
 {id:"mensajes",title:"Comunicaciones",check:"all"},
 {id:"equipo",title:"Equipo",check:"employees"},
];
const punchKinds=[
 ["start","Entrada"],["break_start","Inicio de comida"],["break_end","Fin de comida"],["end","Salida"]
];
const day=t=>t?new Date(t).toLocaleDateString("es-ES"):"—";
const timestamp=t=>t?new Date(t).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"}):"—";
const todayISO=()=>new Date().toLocaleDateString("en-CA");
const shortId=s=>s?String(s).slice(0,8):"—";
function ErrorText({error}){return error?<div className="error" role="alert">{error}</div>:null;}
function Empty({children}){return <div className="empty">{children}</div>;}
function Field({label,children,full}){return <div className={"field"+(full?" full":"")}><label>{label}</label>{children}</div>;}
function Table({heads,rows,empty="Todavía no hay registros."}){
 if(!rows?.length)return <Empty>{empty}</Empty>;
 return <div className="tablewrap"><table className="table"><thead><tr>{heads.map((h,i)=><th key={i}>{h}</th>)}</tr></thead>
 <tbody>{rows.map((cells,i)=><tr key={i}>{cells.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
async function locateOnce(){
 if(typeof navigator==="undefined"||!navigator.geolocation)return {status:"unavailable"};
 return new Promise(resolve=>navigator.geolocation.getCurrentPosition(
  p=>resolve({status:"captured",coords:p.coords}),
  e=>resolve({status:e.code===1?"denied":"unavailable"}),
  {enableHighAccuracy:false,maximumAge:0,timeout:4500}
 ));
}
function downloadCsv(name,rows){
 const q=x=>'"'+String(x??"").replaceAll('"','""')+'"';
 const body="\uFEFF"+rows.map(row=>row.map(q).join(";")).join("\r\n");
 const u=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));
 const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);
}
async function compressPhoto(file){
 if(!file.type.startsWith("image/")||file.type==="image/svg+xml")return file;
 if(file.size<850000)return file;
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{
   try{
    const ratio=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement("canvas");
    c.width=Math.round(img.naturalWidth*ratio);c.height=Math.round(img.naturalHeight*ratio);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    c.toBlob(blob=>{URL.revokeObjectURL(url);
     resolve(blob?new File([blob],file.name.replace(/\.[^.]+$/,"")+".webp",{type:"image/webp"}):file);
    },"image/webp",0.82);
   }catch{URL.revokeObjectURL(url);resolve(file)}
  };
  img.onerror=()=>{URL.revokeObjectURL(url);resolve(file)};
  img.src=url;
 });
}

function Login({db,onSuccess}){
 const [username,setUsername]=useState(""),[password,setPassword]=useState("");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function signIn(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   const email=technicalEmail(username.trim());
   const {error:err}=await db.auth.signInWithPassword({email,password});
   if(err)throw new Error("No se ha podido iniciar sesión. Comprueba usuario y contraseña.");
   setPassword("");onSuccess();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="login-page"><section className="login">
 <div className="kicker">Portal privado · Producción</div><h1>Acceso a PINASTER 360</h1>
 <p>Accede con tu usuario corporativo y contraseña individual. No existe registro público.</p>
 <ErrorText error={error}/>
 <form onSubmit={signIn}>
  <Field label="Usuario"><input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Nombre_Pinaster" required/></Field>
  <Field label="Contraseña"><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></Field>
  <button className="btn primary" disabled={busy} type="submit">{busy?"Verificando…":"Entrar"}</button>
 </form><p className="small">Las contraseñas se entregan individualmente. Si necesitas recuperarla, contacta con la administración de PINASTER.</p>
 </section></div>;
}
function MfaGate({db,onDone}){
 const [enrollment,setEnrollment]=useState(null),[factor,setFactor]=useState(null);
 const [code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let cancelled=false;
 (async()=>{
  const r=await db.auth.mfa.listFactors();
  const verified=r.data?.totp?.find(f=>f.status==="verified");
  if(!cancelled){setFactor(verified?.id||null);setLoading(false)}
 })();return()=>{cancelled=true}},[db]);
 async function enroll(){
  setError("");setBusy(true);
  const {data,error:e}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"PINASTER 360"});
  if(e)setError(e.message);else setEnrollment(data);
  setBusy(false);
 }
 async function verify(){
  setError("");setBusy(true);
  try{
   const id=factor||enrollment?.id;
   if(!id)throw new Error("Primero configura tu aplicación de autenticación.");
   const {data:challenge,error:ce}=await db.auth.mfa.challenge({factorId:id});
   if(ce)throw ce;
   const {error:ve}=await db.auth.mfa.verify({factorId:id,challengeId:challenge.id,code});
   if(ve)throw ve;
   await db.auth.refreshSession();onDone();
  }catch(e){setError("No se ha podido verificar el código: "+e.message)}
  finally{setBusy(false)}
 }
 return <div className="login-page"><div className="login">
  <div className="kicker">Protección obligatoria</div><h1>Verificación en dos pasos</h1>
  <p>Tu perfil requiere un segundo factor antes de acceder a los datos de la empresa.</p>
  {loading?<p>Consultando métodos…</p>:<>{!factor&&!enrollment?
   <button className="btn primary" disabled={busy} onClick={enroll}>Configurar aplicación de autenticación</button>
   :<div className="stack">
    {enrollment?.totp?.qr_code&&<div><p>Escanea este código con una aplicación autenticadora:</p>
     <img className="qr" src={enrollment.totp.qr_code} alt="Código QR para configurar autenticación en dos pasos"/>
     <p className="small">Guarda tu aplicación autenticadora en un dispositivo de confianza.</p></div>}
    <Field label="Código de seis dígitos"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></Field>
    <button className="btn primary" disabled={busy||code.length!==6} onClick={verify}>Verificar código</button>
   </div>}</>}
  <ErrorText error={error}/>
  <button className="btn light" style={{marginTop:18}} onClick={()=>db.auth.signOut()}>Salir</button>
 </div></div>;
}
export default function Page(){
 const db=useMemo(()=>getDb(),[]);
 const [authUser,setAuthUser]=useState(null),[me,setMe]=useState(null),[roles,setRoles]=useState([]);
 const [perms,setPerms]=useState([]),[ready,setReady]=useState(false),[loading,setLoading]=useState(false);
 const [tab,setTab]=useState("inicio"),[data,setData]=useState({});
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[mfaLevel,setMfaLevel]=useState("aal1");
 const [settings,setSettings]=useState(null);
 const can=useCallback(p=>perms.includes(p),[perms]);
 const has=useCallback((...p)=>p.some(x=>perms.includes(x)),[perms]);
 const title=roles.map(r=>roleTitles[r]).filter(Boolean).join(" / ")||"Personal autorizado";
 const mfaMissing=Boolean(me?.mfa_required&&mfaLevel!=="aal2");
 const refreshIdentity=useCallback(async()=>{
  if(!db){setReady(true);return}
  try{
   const {data:{user}}=await db.auth.getUser();
   setAuthUser(user??null);
   if(!user){setMe(null);setRoles([]);setPerms([]);setReady(true);return}
   const {data:profile,error:pe}=await db.from("employees")
       .select("id,username,full_name,job_title,site_id,mfa_required,is_active")
       .eq("auth_user_id",user.id).maybeSingle();
   if(pe)throw pe;
   setMe(profile||null);
   const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   setMfaLevel(aal?.currentLevel||"aal1");
   if(profile?.id){
    const {data:ur,error:ue}=await db.from("user_roles").select("role_code,site_id").eq("employee_id",profile.id);
    if(ue)throw ue;
    const codes=[...new Set((ur||[]).map(x=>x.role_code))];
    setRoles(codes);
    if(codes.length){
     const {data:grants,error:ge}=await db.from("role_permissions").select("permission_code").in("role_code",codes);
     if(ge)throw ge;
     setPerms([...new Set((grants||[]).map(x=>x.permission_code))]);
    }else setPerms([]);
   }else{setRoles([]);setPerms([])}
   setError("");
  }catch(e){setError("No se pudo comprobar el perfil: "+e.message)}
  finally{setReady(true)}
 },[db]);
 useEffect(()=>{
  if(!db){setReady(true);return}
  const {data:{subscription}}=db.auth.onAuthStateChange((_event)=>{
   setTimeout(()=>{refreshIdentity()},0);
  });
  refreshIdentity();
  return()=>subscription.unsubscribe();
 },[db,refreshIdentity]);

 const loadRecords=useCallback(async()=>{
  if(!db||!me||mfaMissing)return;
  setLoading(true);
  try{
   const defs=[
    ["sites",db.from("sites").select("id,name,is_active").order("name").limit(100)],
    ["employees",db.from("employees").select("id,full_name,site_id,job_title,is_active,username").order("full_name").limit(100)],
    ["jobs",db.from("jobs").select("id,name,code,status,site_id,client_id").order("created_at",{ascending:false}).limit(100)],
    ["assignments",db.from("assignments").select("id,job_id,site_id,starts_at,ends_at,status,notes").order("starts_at",{ascending:false}).limit(100)],
    ["assignment_people",db.from("assignment_people").select("assignment_id,employee_id").limit(200)],
    ["machines",db.from("machines").select("id,code,name,status,is_fit,site_id").order("name").limit(100)],
    ["clock_events",db.from("clock_events").select("id,employee_id,kind,occurred_at,gps_status,offline").order("occurred_at",{ascending:false}).limit(90)],
    ["privacy_acceptances",db.from("privacy_acceptances").select("notice_version").eq("employee_id",me.id).limit(5)],
    ["reports",db.from("work_reports").select("id,employee_id,job_id,summary,work_date,status,site_id,created_at").order("created_at",{ascending:false}).limit(100)],
    ["attachments",db.from("attachments").select("id,report_id,storage_path,filename,mime_type").order("created_at",{ascending:false}).limit(100)],
    ["messages",db.from("messages").select("id,title,body,created_at").order("created_at",{ascending:false}).limit(100)],
    ["app_settings",db.from("app_settings").select("key,value").in("key",["privacy_notice","unpaid_break_minutes"])]
   ];
   const result=await Promise.all(defs.map(async ([key,promise])=>{
    const {data,error}=await promise;return {key,data:data||[],error};
   }));
   setData(Object.fromEntries(result.map(r=>[r.key,r.data])));
   setSettings(result.find(x=>x.key==="app_settings")?.data?.find(x=>x.key==="privacy_notice")?.value||null);
   const failures=result.filter(x=>x.error && !["sites","employees","jobs","machines","assignments","assignment_people","reports","attachments"].includes(x.key));
   if(failures.length) setError(failures.map(x=>x.key+": "+x.error.message).join("; "));
  }catch(e){setError(e.message)}
  finally{setLoading(false)}
 },[db,me?.id,mfaMissing]);
 useEffect(()=>{if(me&&!mfaMissing)loadRecords()},[me?.id,mfaMissing,loadRecords]);

 const sites=data.sites||[],employees=data.employees||[],jobs=data.jobs||[],
 assignments=data.assignments||[],machines=data.machines||[],reports=data.reports||[],
 events=data.clock_events||[],messages=data.messages||[],attachments=data.attachments||[];
 const accepted=(data.privacy_acceptances||[]).some(x=>x.notice_version===settings?.version);
 const privacyPublished=settings?.status==="published"&&typeof settings?.text==="string"&&settings.text.trim().length>30;
 const tabsAvailable=tabs.filter(t=>t.check==="all"||(t.check==="plan"&&has("plan.read.all","plan.read.site","plan.confirm"))||
  (t.check==="reports"&&has("reports.read.all","reports.read.site","reports.manage.all","reports.manage.site"))||
  (t.check==="machines"&&has("machines.read","machines.read.site","machines.manage","machines.availability.read"))||
  (t.check==="employees"&&has("employees.read.all","employees.read.site","employees.manage")));
 const nameFor=(array,id,field="name")=>array.find(r=>r.id===id)?.[field]||shortId(id);
 const run=async(fn)=>{
  setError("");setNotice("");setBusy(true);
  try{await fn();setNotice("Operación completada.");await loadRecords()}
  catch(e){setError(e?.message||"No se pudo completar la operación.")}
  finally{setBusy(false)}
 };
 async function makeSite(e){
  e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name")||"").trim();
  await run(async()=>{if(name.length<2)throw Error("El nombre es demasiado corto.");
   const {error}=await db.from("sites").insert({name});if(error)throw error;e.target.reset()});
 }
 async function makeJob(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  const name=String(f.get("name")||"").trim(),site_id=String(f.get("site_id")||"")||null;
  if(name.length<3)return setError("Escribe el nombre de la obra o servicio.");
  await run(async()=>{
   const {error}=await db.from("jobs").insert({name,site_id,status:"planned",created_by:authUser.id});
   if(error)throw error;e.target.reset()
  });
 }
 async function makeAssignment(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  const job=jobs.find(j=>j.id===f.get("job_id"));
  if(!job)return setError("Selecciona un trabajo.");
  const starts_at=new Date(String(f.get("starts_at"))).toISOString();
  const ends_at=new Date(String(f.get("ends_at"))).toISOString();
  if(new Date(ends_at)<=new Date(starts_at))return setError("La hora final debe ser posterior al inicio.");
  const employeeId=String(f.get("employee_id")||"")||null;
  await run(async()=>{
   if(employeeId){
    const person=employees.find(x=>x.id===employeeId);
    if(!person?.is_active)throw Error("El trabajador seleccionado no está activo.");
    const {data:overlaps,error:oe}=await db.from("assignments").select("id,starts_at,ends_at,status")
      .lt("starts_at",ends_at).gt("ends_at",starts_at).neq("status","cancelled");
    if(oe)throw oe;
    for(const a of overlaps||[]){
     const {data:assigned,error:ae}=await db.from("assignment_people").select("employee_id")
       .eq("assignment_id",a.id).eq("employee_id",employeeId).maybeSingle();
     if(ae)throw ae;
     if(assigned)throw Error("Conflicto: este trabajador ya tiene una asignación en esas horas.");
    }
   }
   const {data:created,error}=await db.from("assignments").insert({
    job_id:job.id,site_id:job.site_id,starts_at,ends_at,status:"confirmed",created_by:authUser.id,
    confirmed_by:authUser.id,confirmed_at:new Date().toISOString()
   }).select("id").single();
   if(error)throw error;
   if(employeeId){
    const {error:pe}=await db.from("assignment_people").insert({assignment_id:created.id,employee_id:employeeId});
    if(pe)throw pe;
   }
   e.target.reset();
  });
 }
 async function makeReport(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  const job=jobs.find(j=>j.id===f.get("job_id"));
  if(!job)return setError("Selecciona un trabajo.");
  const summary=String(f.get("summary")||"").trim(),employeeId=String(f.get("employee_id")||me.id);
  if(summary.length<2)return setError("Describe los trabajos realizados.");
  await run(async()=>{
   const {error}=await db.from("work_reports").insert({
    job_id:job.id,site_id:job.site_id,employee_id:employeeId,work_date:String(f.get("work_date")||todayISO()),
    summary,observations:String(f.get("observations")||""),created_by:authUser.id,status:"draft"
   });if(error)throw error;e.target.reset()
  });
 }
 async function reportStatus(r,status){
  await run(async()=>{
   const update={status};
   if(status==="submitted")update.submitted_at=new Date().toISOString();
   const {error}=await db.from("work_reports").update(update).eq("id",r.id);if(error)throw error
  });
 }
 async function makeMessage(e){
  e.preventDefault();const f=new FormData(e.currentTarget);
  await run(async()=>{
   const {error}=await db.from("messages").insert({
    title:String(f.get("title")||""),body:String(f.get("body")||""),
    author_id:authUser.id,recipient_employee_id:null,recipient_site_id:null
   });if(error)throw error;e.target.reset()
  });
 }
 async function acceptPrivacy(){
  if(!privacyPublished)return setError("El texto informativo aún está pendiente de validación.");
  await run(async()=>{
   const {error}=await db.from("privacy_acceptances")
     .insert({employee_id:me.id,notice_version:settings.version});if(error)throw error;
  });
 }
 async function punch(kind){
  setError("");setNotice("");setBusy(true);
  try{
   if(!privacyPublished||!accepted)throw Error("Debes leer y aceptar el aviso de privacidad aprobado antes de fichar.");
   const gps=await locateOnce();
   const event={request_id:crypto.randomUUID(),employee_id:me.id,kind,
     occurred_at:new Date().toISOString(),offline:false,gps_status:gps.status};
   let {data:rec,error:err}=await db.from("clock_events").insert(event).select("id").single();
   if(err){
    if(typeof navigator!=="undefined"&&!navigator.onLine){
     // Only the timestamp is stored locally. No GPS trail or company data in offline storage.
     const queue=JSON.parse(localStorage.getItem("p360-offline-punches")||"[]");
     queue.push({...event,offline:true,gps_status:"unavailable"});
     localStorage.setItem("p360-offline-punches",JSON.stringify(queue));setNotice("Fichaje guardado localmente, pendiente de sincronizar.");
     return;
    }
    throw err;
   }
   if(gps.status==="captured"&&rec?.id){
    const {error:le}=await db.from("clock_event_locations").insert({
      event_id:rec.id,latitude:gps.coords.latitude,longitude:gps.coords.longitude,
      accuracy_m:gps.coords.accuracy
    });
    if(le)setNotice("Fichaje guardado, pero no se pudo registrar el GPS. Consulta al responsable.");
   }
   if(!gps?.coords)setNotice("Fichaje registrado sin GPS, conforme a tu elección o disponibilidad.");
   else if(!err&&!gps) setNotice("Fichaje registrado.");
   await loadRecords();
  }catch(e){setError(e.message||"No se pudo fichar.")}
  finally{setBusy(false)}
 }
 async function synchronize(){
  if(!me)return;
  const queue=JSON.parse(localStorage.getItem("p360-offline-punches")||"[]");
  if(!queue.length)return;
  const keep=[];
  for(const q of queue){
   if(q.employee_id!==me.id){keep.push(q);continue}
   const {error}=await db.from("clock_events").insert(q);
   if(error&&error.code!=="23505"){keep.push(q)}
  }
  localStorage.setItem("p360-offline-punches",JSON.stringify(keep));
  if(!keep.length){setNotice("Fichajes pendientes sincronizados.");await loadRecords()}
 }
 useEffect(()=>{
  if(!me||mfaMissing)return;
  const handler=()=>{synchronize().catch(()=>{})};
  window.addEventListener("online",handler);
  if(navigator.onLine)handler();
  return()=>window.removeEventListener("online",handler);
 // Do not run on every data refresh; only for the active identity.
 },[me?.id,mfaMissing]);
 async function changeMachine(machine,status){
  await run(async()=>{const {error}=await db.from("machines").update({status}).eq("id",machine.id);if(error)throw error});
 }
 async function uploadReportPhoto(reportId,file){
  await run(async()=>{
   if(!file)throw Error("Selecciona una fotografía o un PDF.");
   const prepared=await compressPhoto(file);
   const type=prepared.type||"";
   if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(type))throw Error("Formato no admitido.");
   if(prepared.size>10*1024*1024)throw Error("El archivo supera 10 MB.");
   const ext=type==="application/pdf"?"pdf":type==="image/webp"?"webp":type==="image/png"?"png":"jpg";
   const path=reportId+"/"+crypto.randomUUID()+"."+ext;
   const {error:storageErr}=await db.storage.from("pinaster-evidence").upload(path,prepared,{upsert:false,contentType:type});
   if(storageErr)throw storageErr;
   const {error:attachErr}=await db.from("attachments").insert({
    report_id:reportId,storage_path:path,filename:prepared.name,
    mime_type:type,size_bytes:prepared.size,uploaded_by:authUser.id
   });
   if(attachErr)throw attachErr;
  });
 }
 async function openAttachment(path){
  setError("");
  const {data:link,error:le}=await db.storage.from("pinaster-evidence").createSignedUrl(path,60);
  if(le)return setError(le.message);
  window.open(link.signedUrl,"_blank","noopener,noreferrer");
 }

 if(!db)return <><Header/><div className="login-page"><div className="login">
   <h1>PINASTER 360</h1><ErrorText error="Falta configurar la conexión segura de Supabase en Vercel."/></div></div></>;
 if(!ready)return <><Header/><div className="login-page"><div className="login">Verificando sesión de acceso…</div></div></>;
 if(!authUser)return <><Header/><Login db={db} onSuccess={refreshIdentity}/></>;
 if(!me||!me.is_active)return <><Header/><div className="login-page"><div className="login"><h1>Acceso pendiente</h1>
 <p>Tu identidad todavía no está vinculada a un empleado activo. Contacta con la administración.</p>
 <button className="btn light" onClick={()=>db.auth.signOut()}>Cerrar sesión</button></div></div></>;
 if(mfaMissing)return <><Header/><MfaGate db={db} onDone={refreshIdentity}/></>;
 return <>
  <Header me={me} title={title} logout={()=>db.auth.signOut()}/>
  <div className="wrap shell">
   <nav className="nav" aria-label="Secciones">
    {tabsAvailable.map(t=><button className={tab===t.id?"active":""} key={t.id} onClick={()=>{setError("");setNotice("");setTab(t.id)}}>{t.title}</button>)}
    <div className="divider"/><button onClick={()=>{setError("");setNotice("");loadRecords()}}>Actualizar datos</button>
   </nav>
   <main className="main">
    <header className="heading"><div><div className="kicker">PINASTER 360 · Entorno privado</div>
     <h1>{tabs.find(t=>t.id===tab)?.title||"Resumen"}</h1>
     <p>{title} · {me.full_name}</p></div><span className="pill">Acceso autenticado</span></header>
    <ErrorText error={error}/>{notice&&<div className="info" role="status">{notice}</div>}
    {loading&&<div className="info">Actualizando información…</div>}
    {tab==="inicio"&&<>
     <section className="card hero"><div className="kicker" style={{color:"#d2ffda"}}>Gestión de operaciones</div>
      <h2>Bienvenido a tu espacio de trabajo</h2><p>Los datos que se muestran se consultan directamente en la base de PINASTER 360. Tu perfil limita qué información puedes ver o modificar.</p>
      <span className="pill">{me.username}</span>
     </section>
     <section className="cols">
      <div className="card"><div className="metriclabel">Trabajos visibles</div><div className="metric">{jobs.length}</div></div>
      <div className="card"><div className="metriclabel">Asignaciones visibles</div><div className="metric">{assignments.length}</div></div>
      <div className="card"><div className="metriclabel">Partes visibles</div><div className="metric">{reports.length}</div></div>
     </section>
     <section className="card"><h2>Empezar</h2>
      <p>Los registros aparecen cuando son creados por personal autorizado. No se incorporan datos ficticios de la antigua demostración.</p>
      <div className="row"><button className="btn primary" onClick={()=>setTab("jornada")}>Mi jornada</button>
       {has("plan.read.all","plan.read.site","plan.confirm")&&<button className="btn" onClick={()=>setTab("planificacion")}>Ver planificación</button>}
       {has("reports.read.all","reports.read.site","reports.manage.all","reports.manage.site")&&<button className="btn" onClick={()=>setTab("partes")}>Ver partes</button>}
      </div></section></>}

    {tab==="jornada"&&<><section className="card"><h2>Registro de jornada</h2>
      <p>Los cuatro eventos son entrada, inicio y fin de comida, y salida. Se solicita la ubicación únicamente en el momento del fichaje, nunca de forma continua.</p>
      {!privacyPublished?<div className="warning">El aviso de privacidad de fichajes y GPS está pendiente de aprobación jurídica. Los fichajes reales permanecen deshabilitados.</div>
      :<div className="card" style={{boxShadow:"none"}}><h2>Información de privacidad</h2><p>{settings.text}</p>
       {!accepted?<button className="btn primary" onClick={acceptPrivacy} disabled={busy}>He leído y acepto la información</button>
        :<span className="pill">Información aceptada</span>}
      </div>}
      <div className="clock-grid">{punchKinds.map(([kind,label])=>
       <button key={kind} className="btn primary" disabled={!privacyPublished||!accepted||!can("time.record.self")||busy} onClick={()=>punch(kind)}>{label}</button>)}
      </div>
      <p className="small muted">Si se rechaza el permiso de ubicación, el fichaje se guarda igualmente sin GPS. En caso de desconexión, los eventos pendientes de este navegador pueden sincronizarse al recuperar Internet.</p>
      <button className="btn light" disabled={busy} onClick={()=>synchronize().catch(e=>setError(e.message))}>Sincronizar pendientes</button>
     </section>
     <section className="card"><h2>Historial de fichajes</h2>
      <Table heads={["Fecha y hora","Tipo","Localización","Origen"]} rows={events.map(ev=>[timestamp(ev.occurred_at),
        punchKinds.find(x=>x[0]===ev.kind)?.[1]||ev.kind,ev.gps_status==="captured"?"GPS puntual":"Sin GPS",ev.offline?"Sin conexión":"En línea"])} empty="Aún no hay fichajes registrados."/></section></>}

    {tab==="planificacion"&&<>
     {can("sites.manage")&&<section className="card"><h2>Crear sede o ámbito de trabajo</h2>
      <form className="form" onSubmit={makeSite}><Field label="Nombre"><input name="name" required minLength={2} placeholder="Sede o área real"/></Field>
       <div className="row"><button className="btn primary" disabled={busy}>Crear ámbito</button></div></form></section>}
     {has("jobs.manage.all","jobs.manage.site")&&<section className="card"><h2>Crear obra o servicio</h2>
      <form className="form" onSubmit={makeJob}>
       <Field label="Nombre del trabajo"><input name="name" minLength={3} required placeholder="Descripción real de la obra"/></Field>
       <Field label="Ámbito"><select name="site_id" required={can("jobs.manage.site")&&!can("jobs.manage.all")}
        defaultValue={me.site_id||""}><option value="">Selecciona un ámbito</option>
        {sites.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
       <button className="btn primary" disabled={busy}>Guardar trabajo</button></form></section>}
     {can("plan.confirm")&&<section className="card"><h2>Nueva asignación</h2>
      <form className="form" onSubmit={makeAssignment}>
       <Field label="Trabajo"><select name="job_id" required><option value="">Seleccionar</option>
        {jobs.filter(j=>j.status!=="cancelled").map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></Field>
       <Field label="Trabajador"><select name="employee_id"><option value="">Sin asignar todavía</option>
        {employees.filter(x=>x.is_active).map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
       <Field label="Inicio"><input required name="starts_at" type="datetime-local"/></Field>
       <Field label="Final"><input required name="ends_at" type="datetime-local"/></Field>
       <button className="btn primary" disabled={busy}>Confirmar asignación</button>
      </form></section>}
     <section className="card"><h2>Obras y servicios</h2>
      <Table heads={["Trabajo","Código","Ámbito","Estado"]} rows={jobs.map(j=>[j.name,j.code||"—",nameFor(sites,j.site_id),<span className="status">{j.status}</span>])}
       empty="Aún no hay obras. El coordinador puede crear la primera."/></section>
     <section className="card"><h2>Asignaciones</h2>
      <Table heads={["Trabajo","Inicio","Fin","Estado"]} rows={assignments.map(a=>[nameFor(jobs,a.job_id),timestamp(a.starts_at),timestamp(a.ends_at),a.status])}
       empty="Todavía no hay asignaciones confirmadas."/></section>
    </>}

    {tab==="partes"&&<>
     {has("reports.manage.all","reports.manage.site")&&<section className="card"><h2>Nuevo parte de trabajo</h2>
      <p>Los partes y el progreso de las obras se introducen por los responsables autorizados, no por el personal de campo.</p>
      <form className="form" onSubmit={makeReport}>
       <Field label="Obra"><select name="job_id" required><option value="">Seleccionar obra real</option>
        {jobs.map(j=><option value={j.id} key={j.id}>{j.name}</option>)}</select></Field>
       <Field label="Trabajador relacionado"><select name="employee_id" defaultValue={me.id}>
        {employees.filter(x=>x.is_active).map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
       <Field label="Fecha"><input name="work_date" type="date" defaultValue={todayISO()} required/></Field>
       <Field label="Observaciones"><input name="observations" placeholder="Incidencias o referencias"/></Field>
       <Field label="Trabajo realizado" full><textarea name="summary" required minLength={2} placeholder="Describe la actuación, materiales y resultados"/></Field>
       <button className="btn primary" disabled={busy}>Guardar borrador</button>
      </form></section>}
     <section className="card"><h2>Partes registrados</h2>
      {!reports.length?<Empty>No hay partes todavía. Los responsables pueden crear el primero cuando existan obras.</Empty>:
       <div className="stack">{reports.map(r=><div key={r.id} className="card" style={{boxShadow:"none",margin:0}}>
        <div className="row"><strong>{nameFor(jobs,r.job_id)}</strong><span className="status">{r.status}</span>
         <span className="small muted">{day(r.work_date)}</span></div>
        <p>{r.summary}</p><div className="row">
         {r.status==="draft"&&has("reports.manage.all","reports.manage.site")&&
          <button className="btn mini" disabled={busy} onClick={()=>reportStatus(r,"submitted")}>Enviar para validar</button>}
         {r.status==="submitted"&&has("reports.validate.all","reports.validate.site")&&<>
          <button className="btn mini primary" disabled={busy} onClick={()=>reportStatus(r,"validated")}>Validar</button>
          <button className="btn mini danger" disabled={busy} onClick={()=>reportStatus(r,"rejected")}>Rechazar</button></>}
        </div>
        {attachments.filter(a=>a.report_id===r.id).map(a=>
         <button key={a.id} className="btn mini light" onClick={()=>openAttachment(a.storage_path)}>Abrir {a.filename}</button>)}
        {r.status==="draft"&&has("reports.manage.all","reports.manage.site")&&
         <div className="up"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
           aria-label="Subir evidencia" onChange={e=>{const f=e.target.files?.[0];if(f)uploadReportPhoto(r.id,f)}}/>
          <span className="muted small">Evidencia privada, máximo 10 MB</span></div>}
       </div>)}</div>}
     </section></>}

    {tab==="maquinaria"&&<section className="card"><h2>Estado de la maquinaria</h2>
      <Table heads={["Equipo","Código","Disponibilidad","Apta","Acciones"]}
      rows={machines.map(m=>[
       m.name,m.code||"—",<span className="status">{m.status}</span>,
       m.is_fit?"Sí":"No",
       can("machines.manage")?<select value={m.status} disabled={busy}
         onChange={e=>changeMachine(m,e.target.value)}>
         {["available","in_use","maintenance","out_of_service"].map(s=><option key={s} value={s}>{s}</option>)}
       </select>:"Solo consulta"
      ])} empty="Todavía no se ha dado de alta maquinaria."/>
      {can("machines.availability.read")&&!can("machines.read")&&
       <div className="warning">La consulta comercial de disponibilidad aún debe pasar la verificación específica de permisos antes de su habilitación.</div>}
     </section>}

    {tab==="mensajes"&&<>
     {can("messages.manage")&&<section className="card"><h2>Publicar comunicación</h2>
      <form className="form" onSubmit={makeMessage}>
       <Field label="Asunto"><input name="title" required maxLength={160}/></Field>
       <Field label="Mensaje" full><textarea name="body" required/></Field>
       <button className="btn primary" disabled={busy}>Publicar para todos</button></form></section>}
     <section className="card"><h2>Comunicaciones recibidas</h2>
      {!messages.length?<Empty>Por ahora no hay comunicaciones.</Empty>:
       <div className="stack">{messages.map(m=><article className="card" key={m.id} style={{boxShadow:"none",margin:0}}>
        <div className="row"><strong>{m.title}</strong><span className="muted small">{timestamp(m.created_at)}</span></div>
        <p>{m.body}</p></article>)}</div>}
     </section></>}

    {tab==="equipo"&&<section className="card"><h2>Empleados visibles para tu rol</h2>
      <Table heads={["Empleado","Usuario","Cargo","Ámbito","Estado"]}
       rows={employees.map(e=>[e.full_name,e.username,e.job_title||"—",
         nameFor(sites,e.site_id),e.is_active?"Activo":"Inactivo"])}
       empty="Los usuarios iniciales aún no se han dado de alta."/>
      <p className="small muted">Las contraseñas nunca se muestran ni se recuperan desde esta pantalla.</p></section>}
    <footer className="footer">PINASTER 360 · Entorno privado de PINASTER MEDIOAMBIENTE · Datos alojados en la UE</footer>
   </main></div>
 </>;
}
function Header({me,title,logout}){
 return <header className="top"><div className="top-inner">
  <div className="brand"><span className="brand-icon">♣</span><span><b>PINASTER 360</b><small>MEDIO AMBIENTE</small></span></div>
  {me&&<div className="top-right"><span className="small user">{title}<br/><b>{me.full_name}</b></span>
   <span className="avatar">{me.full_name.slice(0,1).toUpperCase()}</span>
   <button className="btn mini light" onClick={logout}>Salir</button></div>}
 </div></header>;
}
