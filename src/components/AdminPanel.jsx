import { useState } from "react";
import { Avatar, Pill, RoleBadge, Sheet, SL, FI, PB, CopyBtn } from "./ui";
import { CUR, ROLES, ROLE_LABEL, ROLE_COLOR, CAT_ICONS, canAdmin, cur } from "../lib/constants";
import { findM } from "../lib/utils";
import NetworkGraph from "./NetworkGraph";
import { S_LABEL, S_COLOR } from "../lib/constants";

function NegLimitEditor({ negLimit, onSetNegLimit, T }) {
  const [val, setVal] = useState(Math.abs(negLimit));
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input type="number" min="0" max="1000" value={val} onChange={e=>setVal(Number(e.target.value))}
        style={{flex:1,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,
          padding:"10px 14px",fontSize:15,fontFamily:"inherit",outline:"none"}} />
      <span style={{fontSize:13,color:T.text3,flexShrink:0}}>{CUR.plural}</span>
    </div>
    <PB T={T} onClick={()=>onSetNegLimit(-Math.abs(val))}>Сохранить</PB>
  </div>;
}


function AdminPanel({ members, offers, transactions, invites, balances, news, meId, T,
  categories, onAddCategory, onDeleteCategory, onMoveCategory, onEditCategoryIcon,
  onCreateInvite, onBack, onSelectMember, onFreezeToggle, onDeleteMember,
  onSetRole, onAddNews, onDeleteNews, negLimit, onSetNegLimit }) {

  const [atab,setAtab]=useState("members");
  const [negExpanded,setNegExpanded]=useState(false);
  const [showRoleModal,setShowRoleModal]=useState(null);
  const [showDelConfirm,setShowDelConfirm]=useState(null);
  const [newsTitle,setNewsTitle]=useState("");
  const [newsBody,setNewsBody]=useState("");
  const [newsPinned,setNewsPinned]=useState(false);
  const [newCatName,setNewCatName]=useState("");
  const [newCatIcon,setNewCatIcon]=useState("✦");
  const me=findM(members,meId);
  const isAdmin=canAdmin(me.systemRole);

  const confirmed=transactions.filter(t=>t.status==="confirmed"&&t.type==="exchange");
  const totalVol=confirmed.reduce((s,t)=>s+t.amount,0);
  const negBal=members.filter(m=>(balances[m.id]??m.balance)<-50);
  const frozen=members.filter(m=>m.frozen);
  const catVol={};
  confirmed.forEach(t=>{const o=offers.find(x=>x.id===t.offerId);const cat=o?.category||"Прочее";catVol[cat]=(catVol[cat]||0)+t.amount;});
  const maxVol=Math.max(...Object.values(catVol),1);

  const tabs=[
    {key:"members",l:"Участники"},
    {key:"analytics",l:"Реестр"},
    {key:"graph",l:"Граф"},
    {key:"invites",l:"Инвайты"},
    {key:"gifts",l:"Дары 💛"},
    ...(isAdmin?[{key:"categories",l:"Категории"},{key:"news",l:"Новости"},{key:"settings",l:"Настройки"}]:[]),
  ];

  return <div style={{animation:"fadeUp 0.25s ease"}}>
    <div style={{padding:"18px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
      <span style={{fontSize:11,background:"#fbbf2420",color:"#fbbf24",padding:"3px 10px",borderRadius:10}}>⚙ Панель управления</span>
    </div>
    <div style={{padding:"12px 20px 0"}}>
      <div style={{fontSize:19,fontWeight:700,marginBottom:12}}>Управление сообществом</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:12}}>
        {[
          {l:"Участников",v:members.length,icon:"👥"},
          {l:"Сделок",v:confirmed.length,icon:"⇄"},
          {l:`Оборот`,v:`${totalVol}${CUR.sign}`,icon:"◎"},
          {l:"В минусе",v:negBal.length,icon:"⚠",action:()=>setNegExpanded(!negExpanded),hl:negBal.length>0},
          {l:"Заморожено",v:frozen.length,icon:"❄",hl:frozen.length>0},
          {l:"Предложений",v:offers.filter(o=>o.available).length,icon:"📦"},
        ].map((k,i)=>(
          <div key={i} onClick={k.action} style={{background:T.card,border:`1px solid ${k.hl?"#f8717140":T.border}`,
            borderRadius:12,padding:"9px 11px",cursor:k.action?"pointer":"default"}}>
            <div style={{fontSize:11,color:T.text4,marginBottom:3}}>{k.icon} {k.l}</div>
            <div style={{fontSize:17,fontWeight:700,color:k.hl?"#f87171":T.text}}>{k.v}</div>
          </div>
        ))}
      </div>

      {negExpanded&&negBal.length>0&&<div style={{background:"#1a0d0d",border:"1px solid #7f1d1d",borderRadius:13,padding:"12px 14px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:"#f87171",marginBottom:8}}>⚠ Участники с низким балансом</div>
        {negBal.map(m=><div key={m.id} onClick={()=>onSelectMember(m.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",
          borderBottom:"1px solid #7f1d1d20",cursor:"pointer"}}>
          <Avatar member={m} size={30} />
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.name}</div></div>
          <Pill balance={balances[m.id]??m.balance} />
          <span style={{color:"#f87171",fontSize:12}}>›</span>
        </div>)}
      </div>}

      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:12,overflowX:"auto"}}>
        {tabs.map(t=><button key={t.key} onClick={()=>setAtab(t.key)} style={{
          background:"none",border:"none",padding:"10px 0",marginRight:16,fontSize:13,
          fontWeight:atab===t.key?600:400,color:atab===t.key?T.text:T.text4,
          borderBottom:atab===t.key?"2px solid #6366f1":"2px solid transparent",
          cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.l}</button>)}
      </div>

      {/* MEMBERS TAB */}
      {atab==="members"&&<div>
        {members.map(m=>{
          const bal=balances[m.id]??m.balance;
          const txC=confirmed.filter(t=>t.from===m.id||t.to===m.id).length;
          const isSelf=m.id===meId;
          return <div key={m.id} style={{background:T.card,border:`1px solid ${m.frozen?"#475569":m.id===meId?"#6366f130":T.border}`,
            borderRadius:12,padding:"11px 13px",marginBottom:8,opacity:m.frozen?0.7:1}}>
            <div style={{display:"flex",gap:11,alignItems:"center"}}>
              <div onClick={()=>onSelectMember(m.id)} style={{cursor:"pointer"}}><Avatar member={m} size={38} /></div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:13,cursor:"pointer",color:T.text}}
                    onClick={()=>onSelectMember(m.id)}>{m.name}</span>
                  <RoleBadge role={m.systemRole} />
                  {m.frozen&&<span style={{fontSize:10,background:"#47556920",color:T.text2,padding:"1px 6px",borderRadius:6}}>❄ заморожен</span>}
                </div>
                <div style={{fontSize:11,color:T.text4,marginTop:2}}>{m.profession} · {txC} сделок</div>
              </div>
              <Pill balance={bal} />
            </div>
            {!isSelf&&<div style={{display:"flex",gap:6,marginTop:10,paddingTop:9,borderTop:"1px solid #1e2330"}}>
              {isAdmin&&<button onClick={()=>setShowRoleModal(m.id)} style={{flex:1,background:T.bg,
                border:`1px solid ${T.border}`,color:"#818cf8",padding:"6px",borderRadius:8,
                fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⚙ Роль</button>}
              <button onClick={()=>onFreezeToggle(m.id)} style={{flex:1,background:T.bg,
                border:`1px solid ${T.border}`,color:m.frozen?"#4ade80":"#fbbf24",padding:"6px",borderRadius:8,
                fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{m.frozen?"❄ Разморозить":"❄ Заморозить"}</button>
              {isAdmin&&<button onClick={()=>setShowDelConfirm(m.id)} style={{background:T.bg,
                border:"1px solid #7f1d1d",color:"#f87171",padding:"6px 10px",borderRadius:8,
                fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
            </div>}
          </div>;
        })}
      </div>}

      {/* ANALYTICS TAB */}
      {atab==="analytics"&&<div>
        {Object.keys(catVol).length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"13px 14px",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Оборот по категориям</div>
          {Object.entries(catVol).sort((a,b)=>b[1]-a[1]).map(([cat,vol])=>(
            <div key={cat} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.text2,marginBottom:3}}>
                <span>{CAT_ICONS[cat]||"◎"} {cat}</span><span style={{fontWeight:600}}>{cur(vol)}</span>
              </div>
              <div style={{height:5,background:T.border,borderRadius:3}}>
                <div style={{height:"100%",borderRadius:3,background:"#6366f1",width:`${(vol/maxVol)*100}%`}} /></div>
            </div>
          ))}
        </div>}
        <div style={{fontSize:11,color:T.text4,marginBottom:8}}>Все транзакции · {transactions.length}</div>
        {transactions.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>Транзакций пока нет</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {transactions.map(tx=>{
            const from=findM(members,tx.from),to=findM(members,tx.to);
            const sc=S_COLOR[tx.status]||"#475569";
            return <div key={tx.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
                    <span>{tx.type==="gift"?"💛":"⇄"}</span>
                    <span style={{fontSize:13,fontWeight:500}}>{tx.what}</span>
                  </div>
                  <div style={{fontSize:11,color:T.text3,display:"flex",gap:5,alignItems:"center"}}>
                    <span style={{cursor:"pointer",color:"#6366f1"}} onClick={()=>from.id&&onSelectMember(from.id)}>{from.name.split(" ")[0]}</span>
                    <span>→</span>
                    <span style={{cursor:"pointer",color:"#6366f1"}} onClick={()=>to.id&&onSelectMember(to.id)}>{to.name.split(" ")[0]}</span>
                    <span style={{background:`${sc}20`,color:sc,padding:"1px 5px",borderRadius:5,fontSize:10}}>{S_LABEL[tx.status]||tx.status}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700}}>{cur(tx.amount)}</div>
                  <div style={{fontSize:10,color:T.text5,fontFamily:"monospace"}}>{tx.date}</div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* GRAPH TAB */}
      {atab==="graph"&&<div>
        <NetworkGraph members={members} transactions={transactions} invites={invites} onSelectMember={onSelectMember} />
        <div style={{marginTop:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Топ участников</div>
          {[...members].sort((a,b)=>confirmed.filter(t=>t.from===b.id||t.to===b.id).length-confirmed.filter(t=>t.from===a.id||t.to===a.id).length).slice(0,5).map((m,i)=>{
            const sc=confirmed.filter(t=>t.from===m.id||t.to===m.id).length;
            const inv=members.filter(x=>x.invitedBy===m.id).length;
            return <div key={m.id} onClick={()=>onSelectMember(m.id)} style={{display:"flex",alignItems:"center",gap:10,
              background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 12px",marginBottom:6,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.border}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              <span style={{fontSize:13,color:T.text5,fontWeight:700,width:16}}>#{i+1}</span>
              <Avatar member={m} size={32} />
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:11,color:T.text4}}>{sc} сделок · привёл {inv}</div></div>
              <Pill balance={balances[m.id]??m.balance} />
            </div>;
          })}
        </div>
      </div>}

      {/* INVITES TAB */}
      {atab==="invites"&&<div>
        <PB v="green" onClick={onCreateInvite} s={{marginBottom:12}}>+ Создать инвайт</PB>
        {invites.map(inv=>{
          const creator=inv.createdBy>0?findM(members,inv.createdBy):{name:"Admin",avatar:"⚙",id:0};
          const user=inv.usedBy?findM(members,inv.usedBy):null;
          return <div key={inv.code} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:7,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:user?"#475569":"#e2e8f0"}}>{inv.code}</div>
              <div style={{fontSize:11,color:T.text5,marginTop:2}}>Создал: <span style={{color:T.text2}}>{creator.name}</span> · {inv.createdAt}</div>
              {user?<div style={{fontSize:11,color:"#4ade80",marginTop:2}}>Использовал: {user.name}</div>
                :<div style={{fontSize:11,color:"#fbbf24",marginTop:2}}>Ожидает</div>}
            </div>
            {!user&&<CopyBtn text={inv.code} T={T} />}
          </div>;
        })}
      </div>}

      {/* GIFTS TAB */}
      {atab==="gifts"&&<div>
        <div style={{fontSize:11,color:T.text4,marginBottom:10}}>
          Все дары · {transactions.filter(t=>t.type==="gift").length} записей
        </div>
        {transactions.filter(t=>t.type==="gift").length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>Даров пока не было</div>}
        {[...transactions].filter(t=>t.type==="gift").reverse().map(tx=>{
          const from=findM(members,tx.from),to=findM(members,tx.to);
          return <div key={tx.id} style={{background:T.card,border:"1px solid #22c55e30",borderRadius:10,padding:"10px 14px",marginBottom:7}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span>💛</span><span style={{fontWeight:600,fontSize:13}}>{tx.what}</span>
                </div>
                <div style={{fontSize:12,color:T.text3,display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{cursor:from.id?"pointer":"default",color:from.id?"#6366f1":"#475569"}}
                    onClick={()=>from.id&&onSelectMember(from.id)}>{from.name}</span>
                  <span>→</span>
                  <span style={{cursor:to.id?"pointer":"default",color:to.id?"#6366f1":"#475569"}}
                    onClick={()=>to.id&&onSelectMember(to.id)}>{to.name}</span>
                </div>
                {tx.note&&<div style={{fontSize:11,color:T.text4,marginTop:4,fontStyle:"italic"}}>«{tx.note}»</div>}
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <div style={{fontSize:14,fontWeight:700,color:"#fbbf24"}}>{cur(tx.amount)}</div>
                <div style={{fontSize:10,color:T.text5,fontFamily:"monospace",marginTop:2}}>{tx.date}</div>
              </div>
            </div>
          </div>;
        })}
      </div>}

      {/* NEWS TAB */}
      {/* CATEGORIES TAB */}
      {atab==="categories"&&isAdmin&&<div>
        <div style={{fontSize:12,color:T.text4,marginBottom:12}}>Управление категориями · {(categories||[]).filter(c=>c!=="Все").length} категорий</div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:14,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Добавить категорию</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={newCatIcon} onChange={e=>setNewCatIcon(e.target.value)} placeholder="🏷"
              style={{width:46,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"10px",fontSize:18,fontFamily:"inherit",outline:"none",textAlign:"center"}} />
            <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Название категории"
              style={{flex:1,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
          <PB T={T} disabled={!newCatName.trim()||(categories||[]).includes(newCatName.trim())}
            onClick={()=>{
              if(onAddCategory)onAddCategory(newCatName.trim(),newCatIcon);
              setNewCatName("");setNewCatIcon("✦");
            }}>+ Добавить</PB>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(categories||[]).filter(c=>c!=="Все").map((cat,idx,arr)=>{
            const cnt=offers.filter(o=>o.category===cat).length;
            return <div key={cat} style={{display:"flex",alignItems:"center",gap:8,
              background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                <button onClick={()=>onMoveCategory&&onMoveCategory(cat,-1)} disabled={idx===0}
                  style={{background:"none",border:`1px solid ${T.border}`,color:idx===0?T.text5:T.text3,
                    width:22,height:22,borderRadius:5,fontSize:10,cursor:idx===0?"default":"pointer",
                    fontFamily:"inherit",lineHeight:1,opacity:idx===0?0.3:1}}>▲</button>
                <button onClick={()=>onMoveCategory&&onMoveCategory(cat,1)} disabled={idx===arr.length-1}
                  style={{background:"none",border:`1px solid ${T.border}`,color:idx===arr.length-1?T.text5:T.text3,
                    width:22,height:22,borderRadius:5,fontSize:10,cursor:idx===arr.length-1?"default":"pointer",
                    fontFamily:"inherit",lineHeight:1,opacity:idx===arr.length-1?0.3:1}}>▼</button>
              </div>
              <div style={{width:34,height:34,borderRadius:9,background:T.border,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
                {CAT_ICONS[cat]||"✦"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:T.text}}>{cat}</div>
                <div style={{fontSize:11,color:T.text4}}>{cnt} предложений</div>
              </div>
              <input defaultValue={CAT_ICONS[cat]||"✦"}
                onBlur={e=>{ const v=e.target.value.trim(); if(v&&onEditCategoryIcon) onEditCategoryIcon(cat,v); }}
                style={{width:36,textAlign:"center",fontSize:18,background:T.input,
                  border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"4px",
                  fontFamily:"inherit",outline:"none",flexShrink:0}} title="Иконка" />
              {cnt===0&&<button onClick={()=>onDeleteCategory&&onDeleteCategory(cat)}
                style={{background:"none",border:`1px solid ${T.border}`,color:"#f87171",
                  padding:"4px 9px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
              {cnt>0&&<span style={{fontSize:10,color:T.text5,padding:"2px 6px",background:T.border,borderRadius:5}}>исп.</span>}
            </div>;
          })}
        </div>
      </div>}

      {atab==="news"&&isAdmin&&<div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>Новая новость</div>
          <SL T={T}>Заголовок</SL><FI T={T} value={newsTitle} onChange={setNewsTitle} placeholder="Заголовок" />
          <SL T={T}>Текст</SL><FI T={T} value={newsBody} onChange={setNewsBody} placeholder="Текст новости…" multi />
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}>
            <div onClick={()=>setNewsPinned(!newsPinned)} style={{width:36,height:20,borderRadius:10,background:newsPinned?"#6366f1":T.border,
              cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
              <div style={{position:"absolute",top:2,left:newsPinned?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}} /></div>
            <span style={{fontSize:13,color:T.text3}}>Закрепить</span>
          </div>
          <PB onClick={()=>{if(newsTitle.trim()&&newsBody.trim()){onAddNews({title:newsTitle,body:newsBody,pinned:newsPinned});setNewsTitle("");setNewsBody("");setNewsPinned(false);}}}
            disabled={!newsTitle.trim()||!newsBody.trim()}>Опубликовать</PB>
        </div>
        {[...news].sort((a,b)=>b.pinned-a.pinned).map(n=>(
          <div key={n.id} style={{background:T.card,border:`1px solid ${n.pinned?"#6366f140":T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                {n.pinned&&<span style={{fontSize:10,color:"#6366f1",marginBottom:4,display:"block"}}>📌 Закреплено</span>}
                <div style={{fontWeight:600,fontSize:14,marginBottom:5}}>{n.title}</div>
                <div style={{fontSize:13,color:T.text3,lineHeight:1.5}}>{n.body}</div>
                <div style={{fontSize:11,color:T.text5,marginTop:6,fontFamily:"monospace"}}>{n.date}</div>
              </div>
              <button onClick={()=>onDeleteNews(n.id)} style={{background:"none",border:"none",color:T.text5,fontSize:16,cursor:"pointer",marginLeft:10,flexShrink:0}}>✕</button>
            </div>
          </div>
        ))}
      </div>}
    </div>

    {/* ROLE MODAL */}
    {showRoleModal&&<Sheet onClose={()=>setShowRoleModal(null)}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:14}}>Роль участника</div>
      <div style={{fontSize:13,color:T.text3,marginBottom:16}}>{findM(members,showRoleModal).name}</div>
      {[ROLES.member,ROLES.moderator,ROLES.admin].map(r=>(
        <div key={r} onClick={()=>{onSetRole(showRoleModal,r);setShowRoleModal(null);}} style={{
          display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",marginBottom:8,
          background:findM(members,showRoleModal).systemRole===r?"#6366f115":T.bg,
          border:`1px solid ${findM(members,showRoleModal).systemRole===r?"#6366f140":T.border}`}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:ROLE_COLOR[r]}} />
          <div><div style={{fontWeight:600,fontSize:14}}>{ROLE_LABEL[r]}</div>
            <div style={{fontSize:11,color:T.text3}}>
              {r===ROLES.admin?"Полные права"
                :r===ROLES.moderator?"Управление участниками и предложениями"
                :"Стандартный участник"}
            </div>
          </div>
          {findM(members,showRoleModal).systemRole===r&&<span style={{marginLeft:"auto",color:"#6366f1"}}>✓</span>}
        </div>
      ))}
    </Sheet>}

    {/* DELETE CONFIRM */}
    {showDelConfirm&&<Sheet onClose={()=>setShowDelConfirm(null)}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>Удалить участника?</div>
      <div style={{fontSize:13,color:T.text3,marginBottom:8}}>
        <b style={{color:T.text}}>{findM(members,showDelConfirm).name}</b>
      </div>
      <div style={{fontSize:13,color:T.text3,lineHeight:1.5,marginBottom:20,background:T.bg,padding:"10px 12px",borderRadius:10}}>
        Профиль будет деактивирован. История транзакций сохранится — балансы других участников не изменятся.
        {(balances[showDelConfirm]??0)>0&&<span style={{color:"#fbbf24",display:"block",marginTop:6}}>Положительный баланс ({cur(balances[showDelConfirm])}) перейдёт в общий фонд.</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <PB v="danger" onClick={()=>{onDeleteMember(showDelConfirm);setShowDelConfirm(null);}}>Удалить</PB>
        <PB v="ghost" onClick={()=>setShowDelConfirm(null)} s={{flex:"0 0 90px"}}>Отмена</PB>
      </div>
    </Sheet>}

      {atab==="settings"&&isAdmin&&<div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>⚖️ Лимит задолженности</div>
          <div style={{fontSize:12,color:T.text3,marginBottom:12,lineHeight:1.5}}>
            Участник не может уйти ниже этого значения. Текущий лимит: <b style={{color:"#f87171"}}>-{cur(Math.abs(negLimit))}</b>
          </div>
          <NegLimitEditor negLimit={negLimit} onSetNegLimit={onSetNegLimit} T={T} />
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>📊 Статистика фонда</div>
          {[
            {l:"Участников активных",v:members.filter(m=>!m.frozen).length},
            {l:"Предложений в каталоге",v:offers.filter(o=>o.available&&(o.qty-o.reserved)>0).length},
            {l:"Сделок завершено",v:transactions.filter(t=>t.status==="confirmed").length},
            {l:"Зёрен в обороте",v:parseFloat(Object.values(balances).filter(b=>b>0).reduce((a,b)=>a+b,0).toFixed(1))},
            {l:"Суммарная задолженность",v:parseFloat(Object.values(balances).filter(b=>b<0).reduce((a,b)=>a+b,0).toFixed(1))},
          ].map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,color:T.text3}}>{s.l}</span>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{s.v}</span>
          </div>)}
        </div>
      </div>}

  </div>;
}

export default AdminPanel;
