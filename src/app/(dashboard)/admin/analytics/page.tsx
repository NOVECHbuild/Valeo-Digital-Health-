"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Users, Calendar, DollarSign, TrendingUp, TrendingDown,
  ClipboardList, Activity, Loader2, BarChart2, PieChart,
  Clock, CheckCircle, UserCheck, AlertCircle, Banknote,
  Globe, Stethoscope, CreditCard,
} from "lucide-react";

type UserDoc      = { uid: string; role: string; displayName: string; createdAt: any; };
type Appointment  = { id: string; status: string; sessionType: string; createdAt: any; doctorId: string; clientId: string; };
type Payment      = { id: string; amount: number; status: string; createdAt: any; source: "online"|"manual"; method: string; clientId?: string; };
type Assessment   = { id: string; status: string; assignedAt: any; completedAt: any; };

const C = { ocean:"#2A4A1A", teal:"#8DC63F", teal2:"#6BA028", coral:"#F7941D", gold:"#F7941D", slate:"#8A9BA8" };
const SESSION_COLORS: Record<string,string> = { "Individual Therapy":C.ocean,"Couples Therapy":C.teal,"Life Coaching":C.gold,"Workplace Wellness":C.coral,"Free Consultation":C.slate };

function toDate(ts: any): Date|null { if(!ts)return null; if(ts.toDate)return ts.toDate(); if(ts instanceof Date)return ts; if(typeof ts==="string")return new Date(ts); return null; }
function monthKey(d: Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthLabel(key: string){ const[y,m]=key.split("-"); return new Date(+y,+m-1,1).toLocaleDateString("en-US",{month:"short",year:"2-digit"}); }
function last6MonthKeys(){ const now=new Date(); return Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1); return monthKey(d); }); }
function pctChange(cur:number,prev:number):number|null{ return prev===0?null:Math.round(((cur-prev)/prev)*100); }
const fmt  = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const fmt2 = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

function KpiCard({label,value,sub,accent,Icon,trend}:{label:string;value:string|number;sub?:string;accent:string;Icon:any;trend?:number|null}){
  const up=trend!=null&&trend>=0;
  return(
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:accent+"15"}}><Icon size={18} style={{color:accent}}/></div>
        {trend!=null&&(<span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{background:up?"rgba(43,168,160,0.1)":"rgba(247,148,29,0.1)",color:up?C.teal2:C.coral}}>{up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{Math.abs(trend)}%</span>)}
      </div>
      <div>
        <p className="text-2xl font-bold" style={{fontFamily:"var(--font-dm-serif)",color:C.ocean}}>{value}</p>
        <p className="text-xs mt-0.5" style={{color:C.slate}}>{label}</p>
        {sub&&<p className="text-xs mt-1" style={{color:"#C4C4C4"}}>{sub}</p>}
      </div>
    </div>
  );
}

function SparkLine({data,color=C.teal,height=56}:{data:number[];color?:string;height?:number}){
  const max=Math.max(...data,1),w=300;
  const pts=data.map((v,i)=>{const x=(i/(data.length-1))*w;const y=height-(v/max)*(height-8)-4;return `${x},${y}`;});
  const area=`${pts[0].split(",")[0]},${height} ${pts.join(" ")} ${pts[pts.length-1].split(",")[0]},${height}`;
  return(
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{height}}>
      <defs><linearGradient id={`g${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={area} fill={`url(#g${color.replace("#","")})`}/>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=>{const x=(i/(data.length-1))*w;const y=height-(v/max)*(height-8)-4;return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;  })}
    </svg>
  );
}

function StackedBars({months}:{months:{key:string;online:number;manual:number}[]}){
  const max=Math.max(...months.map(m=>m.online+m.manual),1);
  return(
    <div className="flex items-end gap-2 h-20">
      {months.map(m=>{
        const total=m.online+m.manual,pct=(total/max)*100;
        const manPct=total>0?(m.manual/total)*100:0,onPct=total>0?(m.online/total)*100:0;
        return(
          <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end rounded-t-lg overflow-hidden" style={{height:"56px",background:"rgba(42,74,26,0.04)"}}>
              <div style={{height:`${pct}%`,minHeight:total>0?"4px":"0",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
                <div style={{height:`${manPct}%`,background:C.gold,minHeight:m.manual>0?"3px":"0"}}/>
                <div style={{height:`${onPct}%`,background:C.teal,minHeight:m.online>0?"3px":"0"}}/>
              </div>
            </div>
            <span className="text-xs" style={{color:"#C4C4C4",fontSize:"10px"}}>{monthLabel(m.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Donut({segments,size=100}:{segments:{label:string;value:number;color:string}[];size?:number}){
  const total=segments.reduce((s,x)=>s+x.value,0);
  if(total===0)return(<div className="flex items-center justify-center rounded-full border-4" style={{width:size,height:size,borderColor:"rgba(42,74,26,0.08)"}}><span className="text-xs" style={{color:"#C4C4C4"}}>No data</span></div>);
  const r=36,cx=50,cy=50,circ=2*Math.PI*r;let offset=0;
  return(
    <svg viewBox="0 0 100 100" style={{width:size,height:size}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(42,74,26,0.06)" strokeWidth="14"/>
      {segments.map(seg=>{const dash=(seg.value/total)*circ;const el=(<circle key={seg.label} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset} strokeLinecap="butt" style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>);offset+=dash;return el;})}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" style={{fontSize:"14px",fontWeight:700,fill:C.ocean}}>{total}</text>
    </svg>
  );
}

export default function AdminAnalyticsPage(){
  const[users,setUsers]=useState<UserDoc[]>([]);
  const[appts,setAppts]=useState<Appointment[]>([]);
  const[payments,setPayments]=useState<Payment[]>([]);
  const[assessments,setAssessments]=useState<Assessment[]>([]);
  const[loading,setLoading]=useState(true);
  const[period,setPeriod]=useState<"6m"|"3m"|"1m">("6m");

  useEffect(()=>{
    (async()=>{
      const[uSnap,aSnap,pSnap,mpSnap,asSnap]=await Promise.all([
        getDocs(collection(db,"users")),
        getDocs(query(collection(db,"appointments"),orderBy("createdAt","desc"))),
        getDocs(query(collection(db,"payments"),orderBy("createdAt","desc"))),
        getDocs(query(collection(db,"manualPayments"),orderBy("createdAt","desc"))),
        getDocs(query(collection(db,"assessments"),orderBy("assignedAt","desc"))),
      ]);
      setUsers(uSnap.docs.map(d=>({uid:d.id,...d.data()}) as UserDoc));
      setAppts(aSnap.docs.map(d=>({id:d.id,...d.data()}) as Appointment));
      const online:Payment[]=pSnap.docs.map(d=>{const data=d.data() as any;return{id:d.id,amount:data.amount??0,status:data.status??"pending",createdAt:data.createdAt,source:"online",method:data.provider??"WiPay",clientId:data.clientId};});
      const manual:Payment[]=mpSnap.docs.map(d=>{const data=d.data() as any;return{id:d.id,amount:data.amount??0,status:data.status??"completed",createdAt:data.createdAt,source:"manual",method:data.method??"Cash",clientId:data.clientId};});
      setPayments([...online,...manual]);
      setAssessments(asSnap.docs.map(d=>({id:d.id,...d.data()}) as Assessment));
      setLoading(false);
    })();
  },[]);

  const now=new Date(),months6=last6MonthKeys(),months3=months6.slice(3),months1=months6.slice(5);
  const activeMonths=period==="6m"?months6:period==="3m"?months3:months1;
  const thisMonth=monthKey(now),lastMonth=monthKey(new Date(now.getFullYear(),now.getMonth()-1,1));

  const clients=users.filter(u=>u.role==="client"),doctors=users.filter(u=>u.role==="doctor");
  const newClientsThisM=clients.filter(u=>{const d=toDate(u.createdAt);return d&&monthKey(d)===thisMonth;}).length;
  const newClientsLastM=clients.filter(u=>{const d=toDate(u.createdAt);return d&&monthKey(d)===lastMonth;}).length;
  const completedAppts=appts.filter(a=>a.status==="completed"),pendingAppts=appts.filter(a=>a.status==="pending"),cancelledAppts=appts.filter(a=>a.status==="cancelled");
  const apptThisM=completedAppts.filter(a=>{const d=toDate(a.createdAt);return d&&monthKey(d)===thisMonth;}).length;
  const apptLastM=completedAppts.filter(a=>{const d=toDate(a.createdAt);return d&&monthKey(d)===lastMonth;}).length;
  const completedPay=payments.filter(p=>p.status==="completed");
  const totalRevenue=completedPay.reduce((s,p)=>s+p.amount,0);
  const onlineRevenue=completedPay.filter(p=>p.source==="online").reduce((s,p)=>s+p.amount,0);
  const manualRevenue=completedPay.filter(p=>p.source==="manual").reduce((s,p)=>s+p.amount,0);
  const revThisM=completedPay.filter(p=>{const d=toDate(p.createdAt);return d&&monthKey(d)===thisMonth;}).reduce((s,p)=>s+p.amount,0);
  const revLastM=completedPay.filter(p=>{const d=toDate(p.createdAt);return d&&monthKey(d)===lastMonth;}).reduce((s,p)=>s+p.amount,0);
  const avgSessionValue=completedAppts.length>0?totalRevenue/completedAppts.length:0;

  const methodBreakdown=useMemo(()=>{
    const counts:Record<string,number>={};
    completedPay.forEach(p=>{const m=p.method||"Unknown";counts[m]=(counts[m]??0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  },[completedPay]);

  const monthlyData=useMemo(()=>activeMonths.map(key=>{
    const newClients=clients.filter(u=>{const d=toDate(u.createdAt);return d&&monthKey(d)===key;}).length;
    const sessions=completedAppts.filter(a=>{const d=toDate(a.createdAt);return d&&monthKey(d)===key;}).length;
    const online=completedPay.filter(p=>p.source==="online"&&toDate(p.createdAt)&&monthKey(toDate(p.createdAt)!)===key).reduce((s,p)=>s+p.amount,0);
    const manual=completedPay.filter(p=>p.source==="manual"&&toDate(p.createdAt)&&monthKey(toDate(p.createdAt)!)===key).reduce((s,p)=>s+p.amount,0);
    const assessDone=assessments.filter(a=>{const d=toDate(a.completedAt);return d&&monthKey(d)===key;}).length;
    return{key,newClients,sessions,online,manual,revenue:online+manual,assessDone};
  }),[activeMonths,clients,completedAppts,completedPay,assessments]);

  const sessionTypes=useMemo(()=>{
    const counts:Record<string,number>={};
    completedAppts.forEach(a=>{const t=a.sessionType||"Other";counts[t]=(counts[t]??0)+1;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value,color:SESSION_COLORS[label]??C.slate}));
  },[completedAppts]);

  const doctorPerf=useMemo(()=>doctors.map(doc=>{
    const sessions=completedAppts.filter(a=>a.doctorId===doc.uid).length;
    return{name:doc.displayName,sessions};
  }).sort((a,b)=>b.sessions-a.sessions),[doctors,completedAppts]);

  const assessTotal=assessments.length,assessCompleted=assessments.filter(a=>a.status==="completed").length;
  const assessRate=assessTotal>0?Math.round((assessCompleted/assessTotal)*100):0;
  const apptRate=appts.length>0?Math.round((completedAppts.length/appts.length)*100):0;
  const sessionsByClient:Record<string,number>={};
  completedAppts.forEach(a=>{sessionsByClient[a.clientId]=(sessionsByClient[a.clientId]??0)+1;});
  const returningClients=Object.values(sessionsByClient).filter(n=>n>1).length;
  const retentionRate=clients.length>0?Math.round((returningClients/clients.length)*100):0;

  if(loading)return(<div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin" style={{color:C.teal}}/></div>);

  return(
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{fontFamily:"var(--font-dm-serif)",color:C.ocean}}>Analytics</h2>
          <p className="text-sm mt-0.5" style={{color:C.slate}}>Platform performance and clinical activity overview</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{background:"rgba(42,74,26,0.06)"}}>
          {(["1m","3m","6m"] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{background:period===p?"white":"transparent",color:period===p?C.ocean:C.slate,boxShadow:period===p?"0 1px 3px rgba(42,74,26,0.1)":"none"}}>
              {p==="1m"?"1 Month":p==="3m"?"3 Months":"6 Months"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Clients"      Icon={Users}      accent={C.ocean} value={clients.length}        sub={`+${newClientsThisM} this month`}        trend={pctChange(newClientsThisM,newClientsLastM)}/>
        <KpiCard label="Sessions Completed" Icon={Calendar}   accent={C.teal}  value={completedAppts.length} sub={`${apptThisM} this month`}               trend={pctChange(apptThisM,apptLastM)}/>
        <KpiCard label="Total Revenue"      Icon={DollarSign} accent={C.gold}  value={fmt(totalRevenue)}      sub={`${fmt(revThisM)} this month`}           trend={pctChange(revThisM,revLastM)}/>
        <KpiCard label="Avg. Session Value" Icon={CreditCard} accent={C.coral} value={fmt2(avgSessionValue)}  sub={`${completedAppts.length} paid sessions`}/>
      </div>

      {/* Revenue Split + Stacked Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <p className="text-sm font-semibold mb-4" style={{color:C.ocean}}>Revenue Split</p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs" style={{color:"#4A5568"}}><Globe size={12} style={{color:C.teal}}/> Online (WiPay)</span>
                <span className="text-xs font-bold" style={{color:C.ocean}}>{fmt(onlineRevenue)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(42,74,26,0.06)"}}>
                <div className="h-full rounded-full" style={{width:`${totalRevenue>0?(onlineRevenue/totalRevenue)*100:0}%`,background:C.teal}}/>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs" style={{color:"#4A5568"}}><Banknote size={12} style={{color:C.gold}}/> Manual / Cash</span>
                <span className="text-xs font-bold" style={{color:C.ocean}}>{fmt(manualRevenue)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(42,74,26,0.06)"}}>
                <div className="h-full rounded-full" style={{width:`${totalRevenue>0?(manualRevenue/totalRevenue)*100:0}%`,background:C.gold}}/>
              </div>
            </div>
            {methodBreakdown.length>0&&(
              <div className="pt-2 border-t space-y-2" style={{borderColor:"rgba(42,74,26,0.06)"}}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{color:C.slate}}>By Method</p>
                {methodBreakdown.map(([method,count])=>(
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-xs" style={{color:"#4A5568"}}>{method}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:"rgba(42,74,26,0.06)",color:C.ocean}}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-semibold" style={{color:C.ocean}}>Revenue Trend</p>
              <p className="text-xs" style={{color:C.slate}}>Online + Manual — completed payments</p>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{color:C.slate}}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:C.teal}}/> Online</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{background:C.gold}}/> Manual</span>
            </div>
          </div>
          <p className="text-2xl font-bold mb-4" style={{fontFamily:"var(--font-dm-serif)",color:C.ocean}}>{fmt(totalRevenue)}</p>
          <StackedBars months={monthlyData}/>
        </div>
      </div>

      {/* Sessions + Session Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <div className="flex items-center justify-between mb-4">
            <div><p className="text-sm font-semibold" style={{color:C.ocean}}>Sessions Over Time</p><p className="text-xs" style={{color:C.slate}}>Completed appointments per month</p></div>
            <BarChart2 size={16} style={{color:C.slate}}/>
          </div>
          <div className="flex items-end gap-2 h-20">
            {monthlyData.map(m=>{
              const max=Math.max(...monthlyData.map(x=>x.sessions),1),pct=(m.sessions/max)*100;
              return(
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg flex items-end" style={{height:"56px",background:"rgba(42,74,26,0.04)"}}>
                    <div className="w-full rounded-t-lg" style={{height:`${Math.max(pct,2)}%`,background:C.teal,minHeight:m.sessions>0?"4px":"0"}}/>
                  </div>
                  <span className="text-xs" style={{color:"#C4C4C4",fontSize:"10px"}}>{monthLabel(m.key)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs" style={{color:C.slate}}><span className="w-2.5 h-2.5 rounded-full" style={{background:C.teal}}/> Completed sessions</span>
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <div className="flex items-center justify-between mb-4">
            <div><p className="text-sm font-semibold" style={{color:C.ocean}}>Session Types</p><p className="text-xs" style={{color:C.slate}}>All completed</p></div>
            <PieChart size={16} style={{color:C.slate}}/>
          </div>
          <div className="flex justify-center mb-4"><Donut segments={sessionTypes} size={100}/></div>
          <div className="space-y-2">
            {sessionTypes.length===0?(<p className="text-xs text-center" style={{color:"#C4C4C4"}}>No sessions yet</p>):sessionTypes.map(s=>(
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/><span className="text-xs truncate" style={{color:"#4A5568",maxWidth:"130px"}}>{s.label}</span></div>
                <span className="text-xs font-semibold" style={{color:C.ocean}}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client Growth + Doctor Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <div className="flex items-center justify-between mb-1">
            <div><p className="text-sm font-semibold" style={{color:C.ocean}}>Client Growth</p><p className="text-xs" style={{color:C.slate}}>New registrations</p></div>
            <UserCheck size={16} style={{color:C.slate}}/>
          </div>
          <p className="text-2xl font-bold mb-3" style={{fontFamily:"var(--font-dm-serif)",color:C.ocean}}>{clients.length}</p>
          <SparkLine data={monthlyData.map(m=>m.newClients)} color={C.ocean}/>
          <div className="flex justify-between mt-2">
            {monthlyData.map(m=><span key={m.key} className="text-xs" style={{color:"#C4C4C4",fontSize:"10px"}}>{monthLabel(m.key)}</span>)}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <div className="flex items-center justify-between mb-4">
            <div><p className="text-sm font-semibold" style={{color:C.ocean}}>Doctor Performance</p><p className="text-xs" style={{color:C.slate}}>Sessions per therapist</p></div>
            <Stethoscope size={16} style={{color:C.slate}}/>
          </div>
          {doctorPerf.length===0?(<p className="text-xs text-center py-6" style={{color:"#C4C4C4"}}>No doctors yet</p>):(
            <div className="space-y-3">
              {doctorPerf.map(doc=>(
                <div key={doc.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:"rgba(42,74,26,0.03)",border:"1px solid rgba(42,74,26,0.06)"}}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{background:"linear-gradient(135deg,#1E3810,#2D2D4E)",color:"white"}}>{doc.name?.[0]?.toUpperCase()??"D"}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{color:"#1E3810"}}>{doc.name}</p><p className="text-xs" style={{color:C.slate}}>{doc.sessions} sessions</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Health + Appointment Status + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <p className="text-sm font-semibold mb-4" style={{color:C.ocean}}>Platform Health</p>
          <div className="space-y-4">
            {[{label:"Appointment completion",pct:apptRate,color:C.teal},{label:"Assessment completion",pct:assessRate,color:C.coral},{label:"Client retention",pct:retentionRate,color:C.gold}].map(({label,pct,color})=>(
              <div key={label}>
                <div className="flex items-center justify-between mb-1"><span className="text-xs" style={{color:"#4A5568"}}>{label}</span><span className="text-xs font-semibold" style={{color:C.ocean}}>{pct}%</span></div>
                <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(42,74,26,0.06)"}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:color}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <p className="text-sm font-semibold mb-4" style={{color:C.ocean}}>Appointment Status</p>
          <div className="space-y-3">
            {[{label:"Completed",value:completedAppts.length,color:C.teal,Icon:CheckCircle},{label:"Pending",value:pendingAppts.length,color:C.gold,Icon:Clock},{label:"Cancelled",value:cancelledAppts.length,color:C.coral,Icon:AlertCircle}].map(({label,value,color,Icon})=>(
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{background:color+"0D"}}>
                <Icon size={14} style={{color}}/><span className="text-sm flex-1" style={{color:"#4A5568"}}>{label}</span><span className="text-sm font-bold" style={{color:C.ocean}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
          <p className="text-sm font-semibold mb-4" style={{color:C.ocean}}>Quick Stats</p>
          <div className="space-y-3">
            {[
              {label:"Active doctors",       value:doctors.length,                    accent:C.ocean},
              {label:"Avg sessions/client",  value:clients.length>0?(completedAppts.length/clients.length).toFixed(1):"0", accent:C.teal},
              {label:"Avg session value",    value:fmt2(avgSessionValue),             accent:C.gold},
              {label:"Pending assessments",  value:assessments.filter(a=>a.status==="pending").length, accent:C.gold},
              {label:"Returning clients",    value:returningClients,                  accent:C.coral},
              {label:"Manual payments",      value:payments.filter(p=>p.source==="manual"&&p.status==="completed").length, accent:C.slate},
            ].map(({label,value,accent})=>(
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{borderColor:"rgba(42,74,26,0.05)"}}>
                <span className="text-xs" style={{color:"#4A5568"}}>{label}</span>
                <span className="text-sm font-bold" style={{color:accent}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assessment Activity */}
      <div className="rounded-2xl p-5" style={{background:"white",boxShadow:"0 1px 4px rgba(42,74,26,0.07)"}}>
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-sm font-semibold" style={{color:C.ocean}}>Assessment Activity</p><p className="text-xs" style={{color:C.slate}}>Assigned vs completed per month</p></div>
          <Activity size={16} style={{color:C.slate}}/>
        </div>
        <div className="space-y-3">
          {monthlyData.map(m=>{
            const assigned=assessments.filter(a=>{const d=toDate(a.assignedAt);return d&&monthKey(d)===m.key;}).length;
            const completed=m.assessDone,maxVal=Math.max(assigned,1);
            return(
              <div key={m.key} className="grid grid-cols-[80px_1fr] gap-3 items-center">
                <span className="text-xs text-right" style={{color:C.slate}}>{monthLabel(m.key)}</span>
                <div className="space-y-1.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs"><span style={{color:"#4A5568"}}>Assigned</span><span className="font-semibold" style={{color:C.ocean}}>{assigned}</span></div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(42,74,26,0.06)"}}><div className="h-full rounded-full" style={{width:`${(assigned/maxVal)*100}%`,background:C.ocean+"90"}}/></div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs"><span style={{color:"#4A5568"}}>Completed</span><span className="font-semibold" style={{color:C.ocean}}>{completed}</span></div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(42,74,26,0.06)"}}><div className="h-full rounded-full" style={{width:`${(completed/maxVal)*100}%`,background:C.teal}}/></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
