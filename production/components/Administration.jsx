"use client";
import {useCallback,useEffect,useState} from "react";
const OPERATIVE_ROLES = [
 ["worker","Trabajador"],["area_lead","Responsable de área"],
 ["workshop","Taller"],["availability","Comercial"],
 ["operations_reader","Administración operativa"]
];
export default function Administration({db,me,can,sites}) {
 const [employees,setEmployees]=useState([]),[assigned,setAssigned]=useState([]);
 const [employeeId,setEmployeeId]=useState(""),[role,setRole]=useState("worker"),[siteId,setSiteId]=useState("");
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  const [a,b]=await Promise.all([
   db.from("employees").select("id,full_name,username,is_active,site_id").order("full_name"),
   db.from("user_roles").select("id,employee_id,role_code,site_id")
  ]);
  if(a.error)throw a.error;
  if(b.error)throw b.error;
  setEmployees(a.data||[]);setAssigned(b.data||[]);
 },[db]);
 useEffect(()=>{reload().catch(e=>setError(e.message))},[reload]);
 async function perform(task){
  setError("");setMessage("");setBusy(true);
  try{await task();await reload();setMessage("Cambios guardados con auditoría de base de datos.");}
  catch(e){setError(e.message||"La operación fue rechazada.");}
  finally{setBusy(false)}
 }
 async function addRole(e){
  e.preventDefault();
  if(!can("roles.manage"))return setError("No tienes autorización para asignar roles.");
  if(!employeeId || employeeId===me.id)return setError("Selecciona otra cuenta activa.");
  if(role==="area_lead"&&!siteId)return setError("Indica el área real del responsable.");
  await perform(async()=>{
   const employee=employees.find(x=>x.id===employeeId);
   if(!employee?.is_active)throw Error("El empleado está inactivo.");
   const selectedScope=role==="area_lead"?siteId:null;
   const {error}=await db.from("user_roles").insert({
    employee_id:employeeId,role_code:role,site_id:selectedScope
   });
   if(error)throw error;
   if(role==="area_lead"){
    const {error:scopeErr}=await db.from("employees").update({site_id:siteId}).eq("id",employeeId);
    if(scopeErr)throw scopeErr;
   }
   setEmployeeId("");setSiteId("");
  });
 }
 async function toggleEmployee(e){
  if(!can("employees.manage")||e.id===me.id)return setError("Operación no autorizada.");
  await perform(async()=>{
   const {error}=await db.from("employees").update({is_active:!e.is_active}).eq("id",e.id);
   if(error)throw error;
  });
 }
 async function removeRole(r){
  if(!can("roles.manage")||r.employee_id===me.id)return setError("Operación no autorizada.");
  if(!OPERATIVE_ROLES.some(([code])=>code===r.role_code))return setError("Ese rol está protegido.");
  if(!window.confirm("¿Retirar este rol operativo?"))return;
  await perform(async()=>{
   const {error}=await db.from("user_roles").delete().eq("id",r.id);
   if(error)throw error;
  });
 }
 const fullName=id=>employees.find(x=>x.id===id)?.full_name||"Empleado";
 const areaName=id=>sites.find(s=>s.id===id)?.name||"Sin ámbito";
 return <div className="stack">
 <section className="card"><h2>Usuarios de la empresa</h2>
 <p>Solo se muestran empleados registrados en PINASTER 360 Producción. El control de permisos se verifica en el servidor de Supabase.</p>
 <div className="warning">Las altas iniciales y sus contraseñas se generan desde el ordenador autorizado, no desde el navegador. Las contraseñas nunca aparecen en este panel.</div>
 {error&&<div className="error" role="alert">{error}</div>}
 {message&&<div className="info" role="status">{message}</div>}
 {!employees.length?<div className="empty">No existen todavía cuentas de empleados. Se habilitarán tras ejecutar el alta segura de Felipe, Ivo y Marcos.</div>:
 <div className="tablewrap"><table className="table">
 <thead><tr><th>Empleado</th><th>Usuario</th><th>Ámbito</th><th>Estado</th><th>Acción</th></tr></thead>
 <tbody>{employees.map(e=><tr key={e.id}>
 <td>{e.full_name}</td><td>{e.username}</td><td>{areaName(e.site_id)}</td>
 <td>{e.is_active?"Activo":"Inactivo"}</td><td>
 {can("employees.manage")&&e.id!==me.id?
 <button className="btn mini" disabled={busy} onClick={()=>toggleEmployee(e)}>{e.is_active?"Desactivar":"Reactivar"}</button>:"Protegido"}
 </td></tr>)}</tbody></table></div>}
 </section>
 {can("roles.manage")&&<section className="card"><h2>Asignaciones de roles</h2>
 <p>Los roles privilegiados, incluido el de superadministrador, solo se asignan mediante el procedimiento seguro de altas.</p>
 <form className="form" onSubmit={addRole}>
 <div className="field"><label>Empleado</label>
 <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} required>
 <option value="">Selecciona un empleado</option>
 {employees.filter(e=>e.is_active&&e.id!==me.id).map(e=>
  <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
 <div className="field"><label>Rol operativo</label>
 <select value={role} onChange={e=>setRole(e.target.value)}>
 {OPERATIVE_ROLES.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div>
 <div className="field"><label>Área (obligatoria para responsable de área)</label>
 <select value={siteId} onChange={e=>setSiteId(e.target.value)} required={role==="area_lead"}>
 <option value="">Sin ámbito</option>
 {sites.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
 <div className="row"><button className="btn primary" disabled={busy}>Asignar rol</button></div></form>
 <div className="tablewrap" style={{marginTop:20}}><table className="table">
 <thead><tr><th>Empleado</th><th>Rol</th><th>Ámbito</th><th>Acción</th></tr></thead>
 <tbody>{assigned.map(r=><tr key={r.id}>
 <td>{fullName(r.employee_id)}</td><td>{r.role_code}</td><td>{areaName(r.site_id)}</td>
 <td>{OPERATIVE_ROLES.some(([code])=>code===r.role_code)&&r.employee_id!==me.id?
 <button className="btn mini danger" disabled={busy} onClick={()=>removeRole(r)}>Retirar</button>:"Protegido"}</td>
 </tr>)}</tbody></table></div>
 </section>}
 </div>;
}
