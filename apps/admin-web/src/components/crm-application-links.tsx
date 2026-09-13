"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CrmLookup } from "./crm-lookup";
import { Button, ErrorState } from "./ui";

export function ApplicationLinks({id}:{id:string}) {
  const [order,setOrder]=useState<{id:string;number:string}|null>(null);
  const [client,setClient]=useState("");const [saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();Promise.all([api<{items:{id:string;number:string}[]}>(`/api/admin/orders?application_id=${id}`,{signal:controller.signal}),api<{client_id:string|null}>(`/api/admin/applications/${id}/client`,{signal:controller.signal})]).then(([o,c])=>{setOrder(o.items[0]??null);setClient(c.client_id??"");}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id]);
  async function save(){setBusy(true);setError("");try{await api(`/api/admin/applications/${id}/client`,{method:"POST",body:JSON.stringify({client_id:client})});setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}finally{setBusy(false);}}
  return <section className="crm-related">{error&&<ErrorState message={error}/>}<Link className="button button--secondary" href={order?`/admin/orders?open=${order.id}`:`/admin/orders?application=${id}`}>{order?`Открыть заказ ${order.number} →`:"Создать заказ →"}</Link><details className="workflow-help"><summary>Связать обращение с клиентом</summary><CrmLookup label="Клиент заявки" path="/api/admin/companies" value={client} disabled={busy||Boolean(order)} onChange={v=>{setClient(v);setSaved(false);}}/><Button disabled={busy||!client||Boolean(order)} onClick={save}>{busy?"Сохраняем…":"Сохранить связь"}</Button>{saved&&<p role="status">Связь с клиентом сохранена.</p>}</details></section>;
}
