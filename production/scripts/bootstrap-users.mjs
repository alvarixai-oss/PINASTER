/*
 * EXECUTE LOCALLY ONLY, never in a web request/build/Vercel.
 * Required variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional real full names: PINASTER_FELIPE_FULLNAME, PINASTER_IVO_FULLNAME,
 * PINASTER_MARCOS_FULLNAME. Ivo needs a real site to gain area permissions:
 * PINASTER_IVO_SITE_ID. No fake area names or demo data.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
const url=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret || !url.startsWith("https://")) throw new Error("Configure SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY localmente.");
if (!url.includes("bwjzmulohyjffvokpprk.supabase.co")) throw new Error("Destino inesperado: no se crearán cuentas en otra base.");
const db=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
const people=[
 {username:"Felipe_Pinaster",name:process.env.PINASTER_FELIPE_FULLNAME?.trim()||"Felipe",role:"supervisor",mfa:true},
 {username:"Ivo_Pinaster",name:process.env.PINASTER_IVO_FULLNAME?.trim()||"Ivo",role:"area_lead",mfa:false,site:process.env.PINASTER_IVO_SITE_ID||null},
 {username:"Marcos_Pinaster",name:process.env.PINASTER_MARCOS_FULLNAME?.trim()||"Marcos",role:"operations_manager",mfa:false}
];
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
function newPassword(length=20){let value="";for(let i=0;i<length;i++)value+=alphabet[randomInt(alphabet.length)];return value;}
function csvEscape(s){return '"'+String(s).replaceAll('"','""')+'"';}
const rows=[["usuario","contrasena_inicial","rol"]];
for(const p of people){
 const {data:existing,error:checkError}=await db.from("employees").select("id").eq("username",p.username).maybeSingle();
 if(checkError) throw checkError;
 if(existing) throw new Error("Cuenta ya existente: "+p.username+"; detenga el proceso y revise el registro.");
 const password=newPassword();
 const {data:auth,error:authError}=await db.auth.admin.createUser({
  email:p.username.toLowerCase()+"@pinaster.invalid", password, email_confirm:true,
  app_metadata:{pinaster_username:p.username}
 });
 if(authError || !auth?.user?.id) throw authError||new Error("Error al crear identidad.");
 const {data:employee,error:profileError}=await db.from("employees").insert({
  auth_user_id:auth.user.id,username:p.username,full_name:p.name,
  is_active:true,mfa_required:p.mfa,first_login_pending:false,
  site_id:p.site??null
 }).select("id").single();
 if(profileError){await db.auth.admin.deleteUser(auth.user.id);throw profileError}
 const {error:roleError}=await db.from("user_roles").insert({
  employee_id:employee.id,role_code:p.role,site_id:p.site??null
 });
 if(roleError){throw new Error("Identidad creada pero asignación de rol fallida para "+p.username+": "+roleError.message)}
 rows.push([p.username,password,p.role]);
}
const output=resolve(process.cwd(),"pinaster-credenciales-"+new Date().toISOString().slice(0,10)+".csv");
writeFileSync(output,rows.map(r=>r.map(csvEscape).join(",")).join("\n")+"\n",{encoding:"utf8",mode:0o600,flag:"wx"});
console.log("Cuentas creadas. Credenciales locales guardadas UNA VEZ en: "+output);
console.log("No envíe este CSV por correo abierto. Distribuya cada clave en privado, luego elimínelo de forma segura.");
