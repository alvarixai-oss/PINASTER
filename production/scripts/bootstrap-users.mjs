/**
 * PINASTER 360 — One-time LOCAL account bootstrap only.
 * Do NOT run on Vercel, GitHub Actions or any shared computer.
 *
 * Needs local environment variables:
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * Display names are exactly Felipe, Ivo and Marcos, with no surnames,
 * PINASTER_IVO_SITE_ID (optional UUID for a real registered work site).
 * If omitted, Ivo will have no area data until Felipe assigns the real scope.
 * The service key must NEVER be committed or sent to chat.
 */
import {createClient} from "@supabase/supabase-js";
import {randomInt} from "node:crypto";
import {openSync,writeSync,closeSync} from "node:fs";
import {resolve} from "node:path";

const ref="bwjzmulohyjffvokpprk";
const url=process.env.SUPABASE_URL?.trim();
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url!=="https://"+ref+".supabase.co" || !serviceKey){
 throw new Error("Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el equipo local de confianza.");
}
if(process.env.VERCEL||process.env.CI){
 throw new Error("Esta operación solo se permite en el ordenador del responsable, no en CI/Vercel.");
}
const ivoSite=process.env.PINASTER_IVO_SITE_ID?.trim()||null;
if(ivoSite&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ivoSite)){
 throw new Error("La sede de Ivo debe ser un UUID real de la base de producción.");
}
const people=[
 {username:"Felipe_Pinaster",name:"Felipe",role:"superadmin",mfa:true,site:null},
 {username:"Ivo_Pinaster",name:"Ivo",role:"area_lead",mfa:false,site:ivoSite},
 {username:"Marcos_Pinaster",name:"Marcos",role:"operations_manager",mfa:false,site:null}
];
const db=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
if(ivoSite){
 const {data:site,error:siteError}=await db.from("sites").select("id").eq("id",ivoSite).eq("is_active",true).maybeSingle();
 if(siteError)throw siteError;
 if(!site)throw new Error("La sede asignada a Ivo no existe o no está activa.");
}

for(const p of people){
 const {data,error}=await db.from("employees").select("id,full_name,mfa_required").eq("username",p.username).is("auth_user_id",null).eq("is_active",false).limit(1);
 if(error)throw error;
 if(data?.length!==1||data[0].full_name!==p.name||data[0].mfa_required!==p.mfa)
  throw new Error("Perfil piloto inactivo no válido: "+p.username);
 p.employeeId=data[0].id;
 const {data:roles,error:rolesError}=await db.from("user_roles").select("role_code,site_id").eq("employee_id",p.employeeId);
 if(rolesError||roles?.length!==1||roles[0]?.role_code!==p.role)
  throw new Error("El rol registrado no coincide para "+p.username);
 if(p.site && roles[0].site_id && roles[0].site_id!==p.site)
  throw new Error("El ámbito registrado no coincide para "+p.username);
}
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
function newPassword(length=20){let out="";for(let n=0;n<length;n++)out+=alphabet[randomInt(alphabet.length)];return out;}
const csvEscape=x=>'"'+String(x).replaceAll('"','""')+'"';
const output=resolve(process.cwd(),"pinaster-credenciales-"+new Date().toISOString().slice(0,10)+".csv");
const fd=openSync(output,"wx",0o600);
try{
 writeSync(fd,["usuario","contrasena_inicial","rol"].map(csvEscape).join(",")+"\n");
 for(const p of people){
  const password=newPassword();
  const {data:identity,error:identityError}=await db.auth.admin.createUser({
   email:p.username.toLowerCase()+"@pinaster.invalid",
   password,email_confirm:true,
   app_metadata:{pinaster_username:p.username}
  });
  if(identityError||!identity?.user?.id)throw identityError||new Error("Error al crear identidad.");
  let linked=false;
  try{
   const {data:e,error:employeeError}=await db.from("employees").update({
     auth_user_id:identity.user.id,
     site_id:p.site||null,is_active:true,first_login_pending:false
   }).eq("id",p.employeeId).is("auth_user_id",null).eq("is_active",false)
     .select("id").single();
   if(employeeError||!e)throw employeeError||new Error("No se pudo vincular el perfil.");
   linked=true;
   // Store only in the local restricted CSV, never in the repo or logs.
   writeSync(fd,[p.username,password,p.role].map(csvEscape).join(",")+"\n");
  }catch(err){
   if(linked){
    const {error:rollbackError}=await db.from("employees")
       .update({auth_user_id:null,is_active:false}).eq("id",p.employeeId);
    if(rollbackError)throw new Error("Alta incompleta; requiere revisión manual para "+p.username);
   }
   const {error:deleteError}=await db.auth.admin.deleteUser(identity.user.id);
   if(deleteError)throw new Error("Identidad parcial sin limpiar; requiere revisión manual para "+p.username);
   throw new Error("No se completó la cuenta "+p.username+": "+String(err.message||err));
  }
 }
}finally{closeSync(fd)}
console.log("Altas terminadas. Credenciales entregables exclusivamente desde el archivo local: "+output);
if(!ivoSite)console.log("ATENCION: Ivo se ha creado sin ámbito. Felipe debe crear el área real y asignársela antes de que Ivo pueda ver actuaciones.");
console.log("Comparta las contraseñas individualmente y elimine el CSV tras el reparto. No lo suba a ningún repositorio.");
