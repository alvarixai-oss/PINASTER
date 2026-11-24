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
 const {data,error}=await db.from("employees").select("id").ilike("username",p.username).limit(1);
 if(error)throw error;
 if(data?.length)throw new Error("La cuenta "+p.username+" ya existe; no se recrean ni se sobreescriben usuarios.");
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
  let createdEmployee=null;
  try{
   const {data:e,error:employeeError}=await db.from("employees").insert({
     auth_user_id:identity.user.id,username:p.username,full_name:p.name,
     site_id:p.site,is_active:true,mfa_required:p.mfa,first_login_pending:false
   }).select("id").single();
   if(employeeError)throw employeeError;
   createdEmployee=e.id;
   const {error:roleError}=await db.from("user_roles").insert({
    employee_id:e.id,role_code:p.role,site_id:p.site
   });
   if(roleError)throw roleError;
  }catch(err){
   if(createdEmployee){
    const {error:cleanupError}=await db.from("employees").delete().eq("id",createdEmployee);
    if(cleanupError)throw new Error("Cuenta parcial, requiere revisión manual: "+p.username+". "+cleanupError.message);
   }
   await db.auth.admin.deleteUser(identity.user.id);
   throw new Error("No se completó la cuenta "+p.username+". "+String(err.message||err));
  }
  // Flush immediately after each successfully provisioned account, even if a later one fails.
  writeSync(fd,[p.username,password,p.role].map(csvEscape).join(",")+"\n");
 }
}finally{closeSync(fd)}
console.log("Altas terminadas. Credenciales entregables exclusivamente desde el archivo local: "+output);
if(!ivoSite)console.log("ATENCION: Ivo se ha creado sin ámbito. Felipe debe crear el área real y asignársela antes de que Ivo pueda ver actuaciones.");
console.log("Comparta las contraseñas individualmente y elimine el CSV tras el reparto. No lo suba a ningún repositorio.");
