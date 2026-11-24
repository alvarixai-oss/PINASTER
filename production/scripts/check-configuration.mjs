import { readFileSync, existsSync } from "node:fs";
const required = ["app/page.jsx","app/globals.css","lib/supabase.js","scripts/bootstrap-users.mjs"];
for (const path of required) {
 if (!existsSync(new URL("../"+path,import.meta.url))) throw new Error("Falta "+path);
}
for (const p of ["app/page.jsx","lib/supabase.js"]) {
 const s=readFileSync(new URL("../"+p,import.meta.url),"utf8");
 for(const forbidden of [/service_role/i,/localStorage\.getItem\(["']admin/i,/demo-admin/i]) {
  if (forbidden.test(s)) throw new Error("Posible patrón inseguro: "+p);
 }
}
console.log("Comprobación estática básica superada. Pendiente QA integrado y auditoría externa.");
