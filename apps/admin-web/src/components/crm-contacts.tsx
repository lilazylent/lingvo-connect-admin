"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorState, Input, Textarea } from "./ui";

type Contact = {id:string;name:string;email:string;phone:string;position:string;notes:string;version:number;archived:boolean};
export function CrmContacts({clientId,disabled}:{clientId:string;disabled:boolean}) {
  const [data,setData]=useState<{items:Contact[];pages:number}|null>(null);
  const [selected,setSelected]=useState<Contact|null>(null);
  const [editing,setEditing]=useState(false);
  const [page,setPage]=useState(1);const [archived,setArchived]=useState(false);
  const [error,setError]=useState("");
  const path=`/api/admin/companies/${clientId}/representatives`;
  const load=useCallback(()=>api<{items:Contact[];pages:number}>(`${path}?page=${page}&archived=${archived}`).then(setData).catch(e=>setError(e.message)),[path,page,archived]);
  useEffect(()=>{void load();},[load]);
  return <section className="crm-related"><header className="crm-section-head"><h3>Контактные лица</h3><Button disabled={disabled} variant="secondary" onClick={()=>{setSelected(null);setEditing(true);}}>Добавить контакт</Button></header>{error&&<ErrorState message={error}/>}<label><input type="checkbox" checked={archived} onChange={e=>{setArchived(e.target.checked);setPage(1);}}/> Показать архив контактов</label>{editing&&<ContactForm key={selected?.id??"new"} item={selected} path={path} onSaved={()=>{setEditing(false);void load();}} onClose={()=>setEditing(false)}/>}<div>{data?.items.map(p=><div className="crm-work" key={p.id}><div><strong>{p.name}</strong><p>{p.position} · {p.email||"Email не указан"} · {p.phone}</p>{p.notes&&<p>{p.notes}</p>}</div><Button disabled={disabled} variant="quiet" onClick={()=>{setSelected(p);setEditing(true);}}>Открыть</Button></div>)}</div>{data?.items.length===0&&<p className="context-note">Контактных лиц пока нет.</p>}{data&&data.pages>1&&<div className="pagination"><Button variant="quiet" disabled={page<=1} onClick={()=>setPage(page-1)}>Назад</Button><span>{page} / {data.pages}</span><Button variant="quiet" disabled={page>=data.pages} onClick={()=>setPage(page+1)}>Далее</Button></div>}</section>;
}

function ContactForm({item,path,onSaved,onClose}:{item:Contact|null;path:string;onSaved:()=>void;onClose:()=>void}) {
  const [fields,setFields]=useState({name:item?.name??"",email:item?.email??"",phone:item?.phone??"",position:item?.position??"",notes:item?.notes??""});
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  function field(k:keyof typeof fields,v:string){setFields({...fields,[k]:v});}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);try{await api(`${path}${item?`/${item.id}`:""}`,{method:item?"PATCH":"POST",body:JSON.stringify({...fields,...(item?{version:item.version}:{})})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}finally{setBusy(false);}}
  async function archive(){if(!item)return;setBusy(true);try{await api(`${path}/${item.id}/archive`,{method:"POST",body:JSON.stringify({version:item.version,archived:!item.archived})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}finally{setBusy(false);}}
  return <form className="crm-work-editor" onSubmit={save}>{error&&<ErrorState message={error}/>}<fieldset className="crm-fields" disabled={busy||item?.archived}><Input label="Имя контактного лица" hint="Можно заполнить позже" value={fields.name} maxLength={160} onChange={e=>field("name",e.target.value)}/><Input label="Должность" value={fields.position} onChange={e=>field("position",e.target.value)}/><Input label="Email контакта" type="email" value={fields.email} onChange={e=>field("email",e.target.value)}/><Input label="Телефон контакта" value={fields.phone} onChange={e=>field("phone",e.target.value)}/><Textarea label="Комментарий о контакте" value={fields.notes} onChange={e=>field("notes",e.target.value)}/></fieldset><div className="form-actions"><Button disabled={busy||item?.archived}>Сохранить контакт</Button>{item&&<Button type="button" variant="quiet" disabled={busy} onClick={archive}>{item.archived?"Восстановить":"В архив"}</Button>}<Button type="button" variant="quiet" onClick={onClose}>Закрыть</Button></div></form>;
}
