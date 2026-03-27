import { useState, useRef } from "react";
import { Avatar, Pill, RoleBadge, Sheet, SL, FI, PB, QtyBar, CopyBtn } from "./ui";
import { ROLES, ROLE_LABEL, CAT_ICONS, S_LABEL, S_COLOR, DEMURRAGE_RATE, DEMURRAGE_THRESHOLD, cur } from "../lib/constants";
import { findM, walletNum, calcDemurrage, today, payPotential } from "../lib/utils";
import useSwipe from "../hooks/useSwipe";
import ReviewsList from "./ReviewsList";
import OfferForm from "./forms/OfferForm";

function DemurrageInfo({ memberId, balances, transactions, T }) {
  const raw = balances[memberId] || 0;
  if(raw <= DEMURRAGE_THRESHOLD) return null;
  const memberTxs = transactions.filter(t=>(t.from===memberId||t.to===memberId)&&t.status==="confirmed");
  const lastDate = memberTxs.length>0 ? memberTxs.map(t=>t.date).sort().reverse()[0] : null;
  const todayStr = new Date().toISOString().slice(0,10);
  const monthsInactive = lastDate ? Math.max(0,(new Date(todayStr)-new Date(lastDate))/(1000*60*60*24*30)) : 0;
  const currentDemurrage = calcDemurrage(raw, monthsInactive);
  const effective = Math.max(0, raw - currentDemurrage);
  const perMonth = calcDemurrage(raw, 1);
  const taxable = raw - DEMURRAGE_THRESHOLD;
  const daysSince = lastDate ? Math.round((new Date(todayStr)-new Date(lastDate))/(1000*60*60*24)) : 0;
  if(perMonth === 0) return null;
  return <div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"11px 14px",marginTop:8}}>
    <div style={{fontSize:12,fontWeight:600,color:"#fb923c",marginBottom:7}}>📉 Демередж</div>
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {currentDemurrage>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Уже начислено</span>
        <span style={{color:"#f87171",fontWeight:600}}>-{cur(currentDemurrage)}</span>
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Облагаемая сумма</span>
        <span style={{color:T.text2}}>{cur(taxable)}</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Ставка в месяц</span>
        <span style={{color:"#fb923c"}}>{(DEMURRAGE_RATE*100).toFixed(0)}% → -{cur(perMonth)}</span>
      </div>
      {daysSince>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Дней без активности</span>
        <span style={{color:T.text2}}>{daysSince}</span>
      </div>}
      <div style={{borderTop:`1px solid ${T.border}`,marginTop:4,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Эффективный баланс</span>
        <span style={{color:"#4ade80",fontWeight:700}}>{cur(effective)}</span>
      </div>
    </div>
    <div style={{fontSize:11,color:T.text5,marginTop:6,lineHeight:1.4}}>💡 Совершите сделку чтобы обнулить таймер</div>
  </div>;
}


function ProfileScreen({ member, members, offers, transactions, balances, invites, meId, T,
  reviews, onReview, categories,
  onBack, onAddOffer, onEditOffer, onToggleOffer, onDeleteOffer,
  onUpdateProfile, onCreateInvite, onCancelTx, onConfirmTx, onSelectMember }) {

  const [ptab,A]=useState("fund");
  const [addOff,B]=useState(false); const [editOff,C]=useState(null); const [editMode,D]=useState(false);
  const [eName,E]=useState(member.name); const [ePro,F]=useState(member.profession||"");
  const [eBio,G]=useState(member.bio||""); const [eHelp,H]=useState(member.helpful||"");
  const [eTg,I]=useState(member.telegram||""); const [eIg,J]=useState(member.instagram||"");
  const photoRef=useRef();

  // swipe right = back
  const swipe=useSwipe(onBack);

  const isMe=member.id===meId;
  const myOff=offers.filter(o=>o.member===member.id);
  const myTx=transactions.filter(tx=>tx.from===member.id||tx.to===member.id);
  const bal=balances[member.id]??member.balance;
  const earned=transactions.filter(tx=>tx.to===member.id&&tx.type==="exchange"&&tx.status==="confirmed").reduce((s,t)=>s+t.amount,0);
  const spent=transactions.filter(tx=>tx.from===member.id&&tx.type==="exchange"&&tx.status==="confirmed").reduce((s,t)=>s+t.amount,0);
  const giftsIn=transactions.filter(tx=>tx.to===member.id&&tx.type==="gift").length;
  const myInvites=invites.filter(i=>i.createdBy===member.id);
  const invBy=member.invitedBy?findM(members,member.invitedBy):null;
  const invitedPeople=members.filter(m=>m.invitedBy===member.id);

  function saveProfile(){onUpdateProfile(member.id,{name:eName,profession:ePro,bio:eBio,helpful:eHelp,telegram:eTg,instagram:eIg});D(false);}
  function handlePhoto(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>onUpdateProfile(member.id,{photo:ev.target.result});r.readAsDataURL(f);}

  const memberReviews = (reviews||[]).filter(r=>r.to===member.id);
  const TABS=[{key:"fund",label:"Фонд"},{key:"history",label:"История"},{key:"reviews",label:`Отзывы${memberReviews.length>0?" ("+memberReviews.length+")":""}`},...(isMe?[{key:"invites",label:"Инвайты"}]:[])];

  return <div style={{animation:"fadeUp 0.25s ease"}} {...swipe}>
    <div style={{padding:"18px 20px 0"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
    </div>
    <div style={{padding:"14px 20px 0"}}>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{position:"relative",flexShrink:0}}>
          <Avatar member={member} size={70} />
          {isMe&&<><button onClick={()=>photoRef.current.click()} style={{position:"absolute",bottom:-2,right:-2,width:23,height:23,borderRadius:"50%",background:"#6366f1",border:"2px solid #0d0f14",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} /></>}
        </div>
        <div style={{flex:1}}>
          {editMode?<FI T={T} value={eName} onChange={E} placeholder="Имя" s={{marginBottom:7}} />
            :<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{fontSize:19,fontWeight:700}}>{member.name}</span>
              {isMe&&<span style={{fontSize:11,background:"#6366f120",color:"#818cf8",padding:"2px 7px",borderRadius:10}}>вы</span>}
              <RoleBadge role={member.systemRole} />
            </div>}
          {editMode?<FI T={T} value={ePro} onChange={F} placeholder="Профессия" s={{marginBottom:0}} />
            :<div style={{fontSize:13,color:T.text3,marginBottom:4}}>{member.profession||"—"}</div>}
          {!editMode&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {member.telegram&&<a href={`https://t.me/${member.telegram.replace("@","")}`} target="_blank" rel="noreferrer"
              style={{fontSize:12,color:"#38bdf8",textDecoration:"none"}}>✈ {member.telegram}</a>}
            {member.instagram&&<a href={`https://instagram.com/${member.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
              style={{fontSize:12,color:"#f472b6",textDecoration:"none"}}>◎ {member.instagram}</a>}
          </div>}
          {member.frozen&&<div style={{fontSize:12,color:T.text2,marginTop:4}}>❄ Аккаунт заморожен</div>}
        </div>
        {isMe&&!editMode&&<button onClick={()=>D(true)} style={{background:T.border,border:"none",color:"#6366f1",padding:"5px 11px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Изменить</button>}
      </div>

      {editMode&&<div style={{marginTop:12}}>
        <SL>Биография</SL><FI T={T} value={eBio} onChange={G} placeholder="О себе…" multi />
        <SL>Чем полезен</SL><FI T={T} value={eHelp} onChange={H} placeholder="Конкретная помощь…" multi />
        <div style={{display:"flex",gap:8,marginBottom:11}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"#38bdf8",marginBottom:4,fontWeight:500}}>✈ Telegram</div>
            <input value={eTg} onChange={e=>I(e.target.value)} placeholder="@username" style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:"#38bdf8",padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"#f472b6",marginBottom:4,fontWeight:500}}>◎ Instagram</div>
            <input value={eIg} onChange={e=>J(e.target.value)} placeholder="@username" style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:"#f472b6",padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
        </div>
        <div style={{display:"flex",gap:8}}><PB onClick={saveProfile}>Сохранить</PB><PB v="ghost" onClick={()=>D(false)} s={{flex:"0 0 76px"}}>Отмена</PB></div>
      </div>}

      {!editMode&&<>
        {member.bio&&<div style={{fontSize:13,color:T.text2,lineHeight:1.5,marginTop:10}}>{member.bio}</div>}
        {member.helpful&&<div style={{fontSize:13,color:T.text3,lineHeight:1.5,background:T.card,borderRadius:10,padding:"9px 12px",marginTop:8,borderLeft:"3px solid #6366f1"}}>
          <span style={{color:"#6366f1",fontWeight:600}}>Полезен: </span>{member.helpful}</div>}

        {/* CLICKABLE invite links */}
        {(invBy||invitedPeople.length>0)&&<div style={{marginTop:10,fontSize:12,background:T.card,borderRadius:10,padding:"9px 12px"}}>
          {invBy&&<div style={{marginBottom:invitedPeople.length>0?5:0}}>
            <span style={{color:T.text4}}>Пришёл по приглашению: </span>
            <span onClick={()=>onSelectMember(invBy.id)} style={{color:"#6366f1",cursor:"pointer",fontWeight:500}}>{invBy.name}</span>
          </div>}
          {invitedPeople.length>0&&<div>
            <span style={{color:T.text4}}>Привёл: </span>
            {invitedPeople.map((m,i)=><span key={m.id}>
              <span onClick={()=>onSelectMember(m.id)} style={{color:"#6366f1",cursor:"pointer",fontWeight:500}}>{m.name.split(" ")[0]}</span>
              {i<invitedPeople.length-1&&<span style={{color:T.text5}}>, </span>}
            </span>)}
          </div>}
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px",gridColumn:"span 3"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:T.text4,marginBottom:5}}>Баланс</div><Pill balance={bal} /></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T.text4,marginBottom:3}}>Кошелёк</div>
                <div style={{fontFamily:"monospace",fontSize:11,color:"#6366f1"}}>{walletNum(member.id,member.joined)}</div>
                <div style={{fontSize:10,color:T.text5,marginTop:2}}>потенциал: {cur(payPotential(member.id,offers,bal))}</div>
              </div>
            </div>
            {isMe&&<DemurrageInfo memberId={member.id} balances={balances} transactions={transactions} T={T} />}
          </div>
          {[{l:"Заработано",v:`+${cur(earned)}`,c:"#4ade80"},{l:"Потрачено",v:`-${cur(spent)}`,c:"#f87171"},{l:"Даров",v:`${giftsIn} 💛`,c:"#fbbf24"}]
            .map((s,i)=><div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 10px"}}>
              <div style={{fontSize:11,color:T.text4,marginBottom:3}}>{s.l}</div>
              <div style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div>
            </div>)}
        </div>

        <div style={{display:"flex",marginTop:12,borderBottom:"1px solid #1e2330"}}>
          {TABS.map(t=><button key={t.key} onClick={()=>A(t.key)} style={{
            background:"none",border:"none",padding:"11px 0",marginRight:16,fontSize:13,
            fontWeight:ptab===t.key?600:400,color:ptab===t.key?T.text:T.text4,
            borderBottom:ptab===t.key?"2px solid #6366f1":"2px solid transparent",
            cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>)}
        </div>
      </>}
    </div>

    {!editMode&&ptab==="fund"&&<div style={{padding:"12px 20px"}}>
      {isMe&&<button onClick={()=>B(true)} style={{width:"100%",background:T.card,border:"1px dashed #2d3548",borderRadius:14,padding:"11px",color:"#6366f1",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:11}}>+ Добавить предложение</button>}
      {myOff.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>{isMe?"Вы пока ничего не добавили":"Нет предложений"}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {myOff.map(o=>{const av=o.qty-o.reserved;return <div key={o.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"13px 14px",opacity:o.available?1:0.5}}>
          <div style={{display:"flex",gap:11}}>
            <div style={{width:38,height:38,borderRadius:10,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{CAT_ICONS[o.category]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{o.title}</div>
              <div style={{fontSize:12,color:T.text3,marginTop:3}}>{o.desc}</div>
              <div style={{marginTop:6,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,fontWeight:600,color:o.price===0?"#4ade80":T.text}}>{o.price===0?"бесплатно":`${cur(o.price)}/${o.unit}`}</span>
                <span style={{fontSize:11,color:o.available?"#4ade80":T.text4}}>{o.available?"● доступно":"○ пауза"}</span>
              </div>
              <QtyBar qty={o.qty} reserved={o.reserved} />
            </div>
          </div>
          {isMe&&<div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid #1e2330"}}>
            <button onClick={()=>C(o)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.text2,padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✏</button>
            <button onClick={()=>onToggleOffer(o.id)} style={{flex:1.5,background:T.bg,border:`1px solid ${T.border}`,color:o.available?"#fbbf24":"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{o.available?"⏸ Пауза":"▶ Активировать"}</button>
            <button onClick={()=>av===o.qty&&onDeleteOffer(o.id)} style={{background:T.bg,border:`1px solid ${T.border}`,color:av<o.qty?"#334155":"#f87171",padding:"7px 12px",borderRadius:8,fontSize:13,cursor:av===o.qty?"pointer":"not-allowed",fontFamily:"inherit"}}>✕</button>
          </div>}
        </div>;})}
      </div>
    </div>}

    {!editMode&&ptab==="history"&&<div style={{padding:"12px 20px"}}>
      {myTx.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0"}}>Нет сделок</div>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {myTx.map(tx=>{
          const isOut=tx.from===member.id,other=isOut?findM(members,tx.to):findM(members,tx.from);
          const isGift=tx.type==="gift",sc=S_COLOR[tx.status]||"#475569";
          const iAmBuyer=tx.from===meId;
          const iAmSeller=tx.to===meId;
          const canConfirm=!tx.reqId&&tx.status==="active"&&iAmBuyer&&member.id===meId;
          const canConfirmReq=tx.reqId&&tx.status==="awaiting_confirm"&&iAmBuyer&&member.id===meId;
          const canMarkDone=tx.reqId&&tx.status==="active"&&iAmSeller&&member.id===meId;
          const canCancel=tx.status==="active"&&!tx.reqId&&(iAmBuyer||iAmSeller);
          return <div key={tx.id} style={{background:T.card,border:`1px solid ${tx.status==="cancelled"?"#334155":T.border}`,borderRadius:12,padding:"11px 13px",opacity:tx.status==="cancelled"?0.4:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                  <span>{isGift?"💛":tx.status==="cancelled"?"✕":isOut?"↑":"↓"}</span>
                  <span style={{fontWeight:500,fontSize:13}}>{tx.what}</span>
                  {tx.qty>1&&<span style={{fontSize:11,color:T.text3}}>×{tx.qty}</span>}
                </div>
                <div style={{fontSize:11,color:T.text4,display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                  <span style={{color:isOut?"#f87171":"#4ade80"}}>{isOut?"вы →":"← вам"}</span>
                  <Avatar member={other} size={14} />
                  <span>{other.name?.split(" ")[0]}</span>
                </div>
                <span style={{fontSize:11,background:`${sc}15`,color:sc,padding:"2px 7px",borderRadius:5}}>{S_LABEL[tx.status]||tx.status}</span>
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <div style={{fontWeight:700,fontSize:14,color:tx.status==="cancelled"?T.text5:isGift?"#fbbf24":isOut?"#f87171":"#4ade80"}}>{isOut?"-":"+"}{cur(tx.amount)}</div>
                <div style={{fontSize:10,color:T.text5,marginTop:2,fontFamily:"monospace"}}>{tx.date}</div>
              </div>
            </div>
            {(canConfirm||canConfirmReq||canMarkDone||canCancel||tx.status==="awaiting_confirm")&&<div style={{display:"flex",gap:7,marginTop:9,flexWrap:"wrap"}}>
              {canConfirm&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Подтвердить получение</button>}
              {canConfirmReq&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Принять работу</button>}
              {canMarkDone&&<button onClick={()=>onMarkDone&&onMarkDone(tx.id)} style={{flex:1,background:"#1e3a5f",border:"1px solid #1d4ed8",color:"#60a5fa",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Выполнено</button>}
              {tx.status==="awaiting_confirm"&&iAmSeller&&<div style={{fontSize:11,color:"#4ade80",padding:"6px 10px",background:"#4ade8010",borderRadius:8,flex:1,textAlign:"center"}}>✓ Ждём подтверждения заказчика</div>}
              {tx.status==="active"&&tx.reqId&&iAmBuyer&&<div style={{fontSize:11,color:"#818cf8",padding:"6px 10px",background:"#6366f110",borderRadius:8,flex:1,textAlign:"center"}}>⏳ Ждём выполнения</div>}
              {canCancel&&<button onClick={()=>onCancelTx(tx.id)} style={{background:T.input,border:"1px solid #7f1d1d",color:"#f87171",padding:"7px 10px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отменить</button>}
            </div>}
            {tx.status==="confirmed"&&(tx.from===meId||tx.to===meId)&&onReview&&(
              (reviews||[]).find(r=>r.txId===tx.id&&r.from===meId)
                ? <div style={{marginTop:8,fontSize:11,color:"#4ade80",padding:"6px 10px",background:"#4ade8010",borderRadius:8,textAlign:"center"}}>⭐ Отзыв оставлен</div>
                : <button onClick={()=>onReview(tx)} style={{marginTop:8,width:"100%",background:T.input,border:`1px solid ${T.border}`,color:T.text3,padding:"6px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                    ⭐ Оставить отзыв
                  </button>
            )}
          </div>;
        })}
      </div>
    </div>}

    {!editMode&&ptab==="reviews"&&<div style={{padding:"12px 20px"}}>
      <ReviewsList reviews={memberReviews} members={members} T={T} />
    </div>}

    {!editMode&&ptab==="invites"&&isMe&&<div style={{padding:"12px 20px"}}>
      <PB v="green" onClick={onCreateInvite} s={{marginBottom:12}}>+ Создать инвайт</PB>
      {myInvites.map(inv=>{const used=inv.usedBy?findM(members,inv.usedBy):null;
        return <div key={inv.code} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:used?T.text4:T.text}}>{inv.code}</div>
            {used?<div style={{fontSize:11,color:"#4ade80",marginTop:2}}>Использовал: <span onClick={()=>onSelectMember(used.id)} style={{cursor:"pointer",textDecoration:"underline"}}>{used.name}</span></div>
              :<div style={{fontSize:11,color:"#fbbf24",marginTop:2}}>Ожидает</div>}
          </div>
          {!used&&<CopyBtn text={inv.code} T={T} />}
        </div>;})}
    </div>}

    {addOff&&<OfferForm T={T} categories={categories} onClose={()=>B(false)} onSave={d=>{onAddOffer(d);B(false);}} />}
    {editOff&&<OfferForm T={T} categories={categories} initial={editOff} onClose={()=>C(null)} onSave={d=>{onEditOffer(editOff.id,d);C(null);}} />}
  </div>;
}

export default ProfileScreen;
