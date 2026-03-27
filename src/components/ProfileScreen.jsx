import { useState, useRef } from "react";
import { Avatar, Pill, RoleBadge, Sheet, SL, FI, PB, QtyBar, CopyBtn } from "./ui";
import { ROLES, ROLE_LABEL, CAT_ICONS, S_LABEL, S_COLOR, DEMURRAGE_RATE, DEMURRAGE_THRESHOLD, cur } from "../lib/constants";
import { findM, walletNum, calcDemurrage, today, payPotential } from "../lib/utils";
import useSwipe from "../hooks/useSwipe";
import ReviewsList from "./ReviewsList";
import OfferForm from "./forms/OfferForm";

function DemurrageInfo({ memberId, balances, transactions }) {
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
  return <div className="demurrage">
    <div className="demurrage-title">📉 Демередж</div>
    <div className="flex-col gap-1">
      {currentDemurrage>0 && <div className="demurrage-row">
        <span style={{color:"var(--color-text-tertiary)"}}>Уже начислено</span>
        <span style={{color:"var(--color-danger)",fontWeight:600}}>-{cur(currentDemurrage)}</span>
      </div>}
      <div className="demurrage-row">
        <span style={{color:"var(--color-text-tertiary)"}}>Облагаемая сумма</span>
        <span style={{color:"var(--color-text-secondary)"}}>{cur(taxable)}</span>
      </div>
      <div className="demurrage-row">
        <span style={{color:"var(--color-text-tertiary)"}}>Ставка в месяц</span>
        <span style={{color:"var(--color-orange)"}}>{(DEMURRAGE_RATE*100).toFixed(0)}% → -{cur(perMonth)}</span>
      </div>
      {daysSince>0 && <div className="demurrage-row">
        <span style={{color:"var(--color-text-tertiary)"}}>Дней без активности</span>
        <span style={{color:"var(--color-text-secondary)"}}>{daysSince}</span>
      </div>}
      <div className="demurrage-row" style={{borderTop:"1px solid var(--color-border)",marginTop:4,paddingTop:6}}>
        <span style={{color:"var(--color-text-tertiary)"}}>Эффективный баланс</span>
        <span style={{color:"var(--color-success)",fontWeight:700}}>{cur(effective)}</span>
      </div>
    </div>
    <div className="demurrage-hint">💡 Совершите сделку чтобы обнулить таймер</div>
  </div>;
}


function ProfileScreen({ member, members, offers, transactions, balances, invites, meId, T,
  reviews, onReview, categories,
  onBack, onAddOffer, onEditOffer, onToggleOffer, onDeleteOffer,
  onUpdateProfile, onCreateInvite, onCancelTx, onConfirmTx, onSelectMember,
  onOpenNotifSettings }) {

  const [ptab,A]=useState("fund");
  const [addOff,B]=useState(false); const [editOff,C]=useState(null); const [editMode,D]=useState(false);
  const [eName,E]=useState(member.name); const [ePro,F]=useState(member.profession||"");
  const [eBio,G]=useState(member.bio||""); const [eHelp,H]=useState(member.helpful||"");
  const [eTg,I]=useState(member.telegram||""); const [eIg,J]=useState(member.instagram||"");
  const photoRef=useRef();

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

  return <div className="anim-fade-up" {...swipe}>
    <div style={{padding:"18px 20px 0"}}>
      <button className="back-btn" onClick={onBack}>← назад</button>
    </div>
    <div className="profile-hero">
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          <Avatar member={member} size={70} />
          {isMe&&<><button className="profile-avatar-edit" onClick={()=>photoRef.current.click()}>📷</button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} /></>}
        </div>
        <div className="flex-1">
          {editMode?<FI T={T} value={eName} onChange={E} placeholder="Имя" s={{marginBottom:7}} />
            :<div className="profile-name">
              <span>{member.name}</span>
              {isMe&&<span className="profile-me-badge">вы</span>}
              <RoleBadge role={member.systemRole} />
            </div>}
          {editMode?<FI T={T} value={ePro} onChange={F} placeholder="Профессия" s={{marginBottom:0}} />
            :<div className="profile-profession">{member.profession||"—"}</div>}
          {!editMode&&<div className="profile-socials">
            {member.telegram&&<a href={`https://t.me/${member.telegram.replace("@","")}`} target="_blank" rel="noreferrer"
              className="profile-social-link profile-social-tg">✈ {member.telegram}</a>}
            {member.instagram&&<a href={`https://instagram.com/${member.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
              className="profile-social-link profile-social-ig">◎ {member.instagram}</a>}
          </div>}
          {member.frozen&&<div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:4}}>❄ Аккаунт заморожен</div>}
        </div>
        {isMe&&!editMode&&<div className="profile-actions">
          {onOpenNotifSettings&&<button className="btn btn-sm btn-ghost" onClick={onOpenNotifSettings} title="Уведомления">🔔</button>}
          <button className="btn btn-sm btn-ghost" onClick={()=>D(true)} style={{color:"var(--color-accent)"}}>Изменить</button>
        </div>}
      </div>

      {editMode&&<div style={{marginTop:12}}>
        <SL>Биография</SL><FI T={T} value={eBio} onChange={G} placeholder="О себе…" multi />
        <SL>Чем полезен</SL><FI T={T} value={eHelp} onChange={H} placeholder="Конкретная помощь…" multi />
        <div className="flex gap-2" style={{marginBottom:11}}>
          <div className="flex-1">
            <div className="section-label-sm" style={{color:"#38bdf8"}}>✈ Telegram</div>
            <input className="input" value={eTg} onChange={e=>I(e.target.value)} placeholder="@username" style={{color:"#38bdf8"}} />
          </div>
          <div className="flex-1">
            <div className="section-label-sm" style={{color:"#f472b6"}}>◎ Instagram</div>
            <input className="input" value={eIg} onChange={e=>J(e.target.value)} placeholder="@username" style={{color:"#f472b6"}} />
          </div>
        </div>
        <div className="flex gap-2"><PB onClick={saveProfile}>Сохранить</PB><PB v="ghost" onClick={()=>D(false)} s={{flex:"0 0 76px"}}>Отмена</PB></div>
      </div>}

      {!editMode&&<>
        {member.bio&&<div className="profile-bio">{member.bio}</div>}
        {member.helpful&&<div className="profile-helpful">
          <span className="profile-helpful-label">Полезен: </span>{member.helpful}</div>}

        {(invBy||invitedPeople.length>0)&&<div className="profile-invite-info">
          {invBy&&<div style={{marginBottom:invitedPeople.length>0?5:0}}>
            <span style={{color:"var(--color-text-muted)"}}>Пришёл по приглашению: </span>
            <span className="profile-invite-link" onClick={()=>onSelectMember(invBy.id)}>{invBy.name}</span>
          </div>}
          {invitedPeople.length>0&&<div>
            <span style={{color:"var(--color-text-muted)"}}>Привёл: </span>
            {invitedPeople.map((m,i)=><span key={m.id}>
              <span className="profile-invite-link" onClick={()=>onSelectMember(m.id)}>{m.name.split(" ")[0]}</span>
              {i<invitedPeople.length-1&&<span style={{color:"var(--color-text-faint)"}}>, </span>}
            </span>)}
          </div>}
        </div>}

        <div className="stat-grid">
          <div className="stat-card stat-card-wide">
            <div className="flex justify-between items-center">
              <div><div className="stat-label">Баланс</div><Pill balance={bal} /></div>
              <div style={{textAlign:"right"}}>
                <div className="stat-label">Кошелёк</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:"var(--text-xs)",color:"var(--color-accent)"}}>{walletNum(member.id,member.joined)}</div>
                <div style={{fontSize:"var(--text-2xs)",color:"var(--color-text-faint)",marginTop:2}}>потенциал: {cur(payPotential(member.id,offers,bal))}</div>
              </div>
            </div>
            {isMe&&<DemurrageInfo memberId={member.id} balances={balances} transactions={transactions} />}
          </div>
          {[{l:"Заработано",v:`+${cur(earned)}`,c:"var(--color-success)"},{l:"Потрачено",v:`-${cur(spent)}`,c:"var(--color-danger)"},{l:"Даров",v:`${giftsIn} 💛`,c:"var(--color-gold)"}]
            .map((s,i)=><div key={i} className="stat-card">
              <div className="stat-label">{s.l}</div>
              <div className="stat-value" style={{color:s.c}}>{s.v}</div>
            </div>)}
        </div>

        <div className="htabs" style={{position:"relative",padding:0,marginTop:12}}>
          {TABS.map(t=><button key={t.key} onClick={()=>A(t.key)}
            className={`htab${ptab===t.key?" htab-active":""}`}>{t.label}</button>)}
        </div>
      </>}
    </div>

    {!editMode&&ptab==="fund"&&<div className="page-section">
      {isMe&&<button className="btn btn-dashed" onClick={()=>B(true)} style={{marginBottom:11}}>+ Добавить предложение</button>}
      {myOff.length===0&&<div className="empty">{isMe?"Вы пока ничего не добавили":"Нет предложений"}</div>}
      <div className="flex-col gap-2 stagger">
        {myOff.map(o=>{const av=o.qty-o.reserved;return <div key={o.id} className="offer-card" style={{opacity:o.available?1:0.5}}>
          <div className="flex gap-3">
            <div className="offer-icon">{CAT_ICONS[o.category]}</div>
            <div className="flex-1">
              <div className="offer-title">{o.title}</div>
              <div className="offer-desc">{o.desc}</div>
              <div className="flex justify-between" style={{marginTop:6}}>
                <span className="offer-price" style={{color:o.price===0?"var(--color-success)":"var(--color-text-primary)"}}>{o.price===0?"бесплатно":`${cur(o.price)}/${o.unit}`}</span>
                <span className="offer-status" style={{color:o.available?"var(--color-success)":"var(--color-text-muted)"}}>{o.available?"● доступно":"○ пауза"}</span>
              </div>
              <QtyBar qty={o.qty} reserved={o.reserved} />
            </div>
          </div>
          {isMe&&<div className="offer-actions">
            <button className="btn btn-sm btn-ghost flex-1" onClick={()=>C(o)}>✏</button>
            <button className="btn btn-sm btn-ghost flex-1" onClick={()=>onToggleOffer(o.id)} style={{color:o.available?"var(--color-gold)":"var(--color-success)"}}>{o.available?"⏸ Пауза":"▶ Активировать"}</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>av===o.qty&&onDeleteOffer(o.id)} style={{color:av<o.qty?"var(--color-border-strong)":"var(--color-danger)",cursor:av===o.qty?"pointer":"not-allowed"}}>✕</button>
          </div>}
        </div>;})}
      </div>
    </div>}

    {!editMode&&ptab==="history"&&<div className="page-section">
      {myTx.length===0&&<div className="empty">Нет сделок</div>}
      <div className="flex-col gap-2 stagger">
        {myTx.map(tx=>{
          const isOut=tx.from===member.id,other=isOut?findM(members,tx.to):findM(members,tx.from);
          const isGift=tx.type==="gift",sc=S_COLOR[tx.status]||"#475569";
          const iAmBuyer=tx.from===meId;
          const iAmSeller=tx.to===meId;
          const canConfirm=!tx.reqId&&tx.status==="active"&&iAmBuyer&&member.id===meId;
          const canConfirmReq=tx.reqId&&tx.status==="awaiting_confirm"&&iAmBuyer&&member.id===meId;
          const canMarkDone=tx.reqId&&tx.status==="active"&&iAmSeller&&member.id===meId;
          const canCancel=tx.status==="active"&&!tx.reqId&&(iAmBuyer||iAmSeller);
          return <div key={tx.id} className={`tx-card${tx.status==="cancelled"?" tx-card-cancelled":""}`}>
            <div className="flex justify-between" style={{alignItems:"flex-start"}}>
              <div className="flex-1">
                <div className="flex items-center gap-2" style={{marginBottom:5}}>
                  <span>{isGift?"💛":tx.status==="cancelled"?"✕":isOut?"↑":"↓"}</span>
                  <span style={{fontWeight:500,fontSize:"var(--text-sm)"}}>{tx.what}</span>
                  {tx.qty>1&&<span style={{fontSize:"var(--text-xs)",color:"var(--color-text-tertiary)"}}>×{tx.qty}</span>}
                </div>
                <div className="flex items-center gap-1" style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginBottom:5}}>
                  <span style={{color:isOut?"var(--color-danger)":"var(--color-success)"}}>{isOut?"вы →":"← вам"}</span>
                  <Avatar member={other} size={14} />
                  <span>{other.name?.split(" ")[0]}</span>
                </div>
                <span className="badge" style={{background:`${sc}15`,color:sc}}>{S_LABEL[tx.status]||tx.status}</span>
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <div style={{fontWeight:700,fontSize:"var(--text-base)",color:tx.status==="cancelled"?"var(--color-text-faint)":isGift?"var(--color-gold)":isOut?"var(--color-danger)":"var(--color-success)"}}>{isOut?"-":"+"}{cur(tx.amount)}</div>
                <div style={{fontSize:"var(--text-2xs)",color:"var(--color-text-faint)",marginTop:2,fontFamily:"var(--font-mono)"}}>{tx.date}</div>
              </div>
            </div>
            {(canConfirm||canConfirmReq||canMarkDone||canCancel||tx.status==="awaiting_confirm")&&<div className="tx-actions">
              {canConfirm&&<button className="btn btn-sm btn-success flex-1" onClick={()=>onConfirmTx(tx.id)}>✓ Подтвердить получение</button>}
              {canConfirmReq&&<button className="btn btn-sm btn-success flex-1" onClick={()=>onConfirmTx(tx.id)}>✓ Принять работу</button>}
              {canMarkDone&&<button className="btn btn-sm btn-primary flex-1" onClick={()=>onMarkDone&&onMarkDone(tx.id)}>✓ Выполнено</button>}
              {tx.status==="awaiting_confirm"&&iAmSeller&&<div className="badge badge-success flex-1" style={{textAlign:"center",padding:"6px 10px"}}>✓ Ждём подтверждения заказчика</div>}
              {tx.status==="active"&&tx.reqId&&iAmBuyer&&<div className="badge badge-accent flex-1" style={{textAlign:"center",padding:"6px 10px"}}>⏳ Ждём выполнения</div>}
              {canCancel&&<button className="btn btn-sm btn-danger" onClick={()=>onCancelTx(tx.id)}>Отменить</button>}
            </div>}
            {tx.status==="confirmed"&&(tx.from===meId||tx.to===meId)&&onReview&&(
              (reviews||[]).find(r=>r.txId===tx.id&&r.from===meId)
                ? <div className="badge badge-success" style={{marginTop:8,textAlign:"center",padding:"6px 10px",width:"100%",justifyContent:"center"}}>⭐ Отзыв оставлен</div>
                : <button className="btn btn-sm btn-ghost w-full" onClick={()=>onReview(tx)} style={{marginTop:8}}>
                    ⭐ Оставить отзыв
                  </button>
            )}
          </div>;
        })}
      </div>
    </div>}

    {!editMode&&ptab==="reviews"&&<div className="page-section">
      <ReviewsList reviews={memberReviews} members={members} T={T} />
    </div>}

    {!editMode&&ptab==="invites"&&isMe&&<div className="page-section">
      <PB v="green" onClick={onCreateInvite} s={{marginBottom:12}}>+ Создать инвайт</PB>
      <div className="stagger">
        {myInvites.map(inv=>{const used=inv.usedBy?findM(members,inv.usedBy):null;
          return <div key={inv.code} className="card flex justify-between items-center" style={{marginBottom:7}}>
            <div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:"var(--text-base)",fontWeight:600,color:used?"var(--color-text-muted)":"var(--color-text-primary)"}}>{inv.code}</div>
              {used?<div style={{fontSize:"var(--text-xs)",color:"var(--color-success)",marginTop:2}}>Использовал: <span className="profile-invite-link" onClick={()=>onSelectMember(used.id)}>{used.name}</span></div>
                :<div style={{fontSize:"var(--text-xs)",color:"var(--color-gold)",marginTop:2}}>Ожидает</div>}
            </div>
            {!used&&<CopyBtn text={inv.code} T={T} />}
          </div>;})}
      </div>
    </div>}

    {addOff&&<OfferForm T={T} categories={categories} onClose={()=>B(false)} onSave={d=>{onAddOffer(d);B(false);}} />}
    {editOff&&<OfferForm T={T} categories={categories} initial={editOff} onClose={()=>C(null)} onSave={d=>{onEditOffer(editOff.id,d);C(null);}} />}
  </div>;
}

export default ProfileScreen;
