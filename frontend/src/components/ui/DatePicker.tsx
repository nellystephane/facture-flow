import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props { value: string; onChange: (value: string) => void; placeholder?: string; min?: string; max?: string; className?: string; disabled?: boolean; }
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const pad = (n:number) => String(n).padStart(2,'0');
const iso = (d:Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromIso = (v:string) => { const [y,m,d] = v.split('-').map(Number); return y && m && d ? new Date(y,m-1,d) : new Date(); };
export default function DatePicker({ value, onChange, placeholder='Choisir une date', min, max, className='', disabled }: Props) {
  const [open,setOpen]=useState(false); const [month,setMonth]=useState(()=>fromIso(value)); const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(value) setMonth(fromIso(value)); },[value]);
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);},[]);
  const days=useMemo(()=>{ const first=new Date(month.getFullYear(),month.getMonth(),1); const start=(first.getDay()+6)%7; const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate(); const out:(number|null)[]=Array(start).fill(null); for(let i=1;i<=count;i++) out.push(i); while(out.length%7) out.push(null); return out;},[month]);
  const pick=(day:number)=>{ const d=new Date(month.getFullYear(),month.getMonth(),day); const v=iso(d); if((min&&v<min)||(max&&v>max)) return; onChange(v); setOpen(false); };
  const label=value?fromIso(value).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):placeholder;
  return <div className="relative" ref={ref}>
    <button type="button" disabled={disabled} onClick={()=>setOpen(v=>!v)} className={`field flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      <span className={value?'text-[#0a0a0c] dark:text-white':'text-gray-400 dark:text-gray-500'}>{label}</span><CalendarDays size={16} className="text-gray-400 shrink-0"/>
    </button>
    {open && <div className="fs-date-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-white/10"><button type="button" className="btn-icon !w-8 !h-8" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={15}/></button><strong className="text-sm">{MOIS[month.getMonth()]} {month.getFullYear()}</strong><button type="button" className="btn-icon !w-8 !h-8" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={15}/></button></div>
      <div className="grid grid-cols-7 gap-1 p-2">{JOURS.map(j=><div key={j} className="text-[10px] text-center text-gray-400 py-1 font-semibold">{j}</div>)}{days.map((day,i)=>day===null?<div key={i}/>:<button key={i} type="button" onClick={()=>pick(day)} className={`h-9 rounded-lg text-sm hover:bg-[#d9524d]/10 hover:text-[#b23c37] ${value===iso(new Date(month.getFullYear(),month.getMonth(),day))?'bg-[#d9524d] text-white hover:text-white hover:bg-[#d9524d] font-bold':''}`}>{day}</button>)}</div>
      <button type="button" className="w-full border-t border-gray-100 dark:border-white/10 px-3 py-2 text-xs font-semibold text-[#d9524d]" onClick={()=>{onChange(iso(new Date()));setOpen(false)}}>Aujourd’hui</button>
    </div>}
  </div>;
}
