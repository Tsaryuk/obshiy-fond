import { useState } from "react";
import { Avatar, Pill } from "./ui";
import { S_LABEL, S_COLOR, cur } from "../lib/constants";
import { findM } from "../lib/utils";
import useSwipe from "../hooks/useSwipe";

function MyTasksScreen({ meId, members, transactions, requests, T, onBack, onConfirmTx, onCancelTx, onMarkDone, onCancelRequest, onSelectMember, onOpenReq, reviews, onReview }) {
  const [ctab, setCtab] = useState("get");
  const swipe = useSwipe(onBack);

  // что я жду получить (я плательщик)
  const iGetActive  = transactions.filter(t=>t.from===meId&&t.type==="exchange"&&(t.status==="active"||t.status==="awaiting_confirm"));
  const iGetDone    = transactions.filter(t=>t.from===meId&&t.type==="exchange"&&t.status==="confirmed");
  // мои обязательства (я поставщик)
  const iGiveActive = transactions.filter(t=>t.to===meId&&t.type==="exchange"&&(t.status==="active"||t.status==="awaiting_confirm"));
  const iGiveDone   = transactions.filter(t=>t.to===meId&&t.type==="exchange"&&t.status==="confirmed");
  // мои открытые запросы
  const myReqs      = requests.filter(r=>r.member===meId);
  // мои отклики
  const myBidReqs   = requests.filter(r=>r.bids.some(b=>b.from===meId&&b.status==="pending")&&r.status==="open");

  function TxCard({ tx, role, reviews, onReview, meId: txMeId }) {
    const other = role==="buyer" ? findM(members,tx.to) : findM(members,tx.from);
    const sc = S_COLOR[tx.status]||"#475569";
    return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:14,color:T.text,marginBottom:4}}>{tx.what}</div>
          <div style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:T.text3}}>
            <Avatar member={other} size={18}/>
            <span onClick={()=>onSelectMember(other.id)} style={{cursor:"pointer",color:T.accent}}>{other.name}</span>
            <span style={{fontSize:11,fontFamily:"monospace",marginLeft:4,color:T.text5}}>{tx.date}</span>
          </div>
        </div>
        <div style={{textAlign:"right",marginLeft:10}}>
          <div style={{fontWeight:700,fontSize:15,color:role==="buyer"?"#f87171":"#4ade80"}}>
            {role==="buyer"?"-":"+"}{cur(tx.amount)}</div>
          <span style={{fontSize:10,background:`${sc}18`,color:sc,padding:"1px 6px",borderRadius:5}}>{S_LABEL[tx.status]}</span>
        </div>
      </div>
      {(tx.status==="active"||tx.status==="awaiting_confirm")&&<div style={{display:"flex",gap:7,marginTop:9,flexWrap:"wrap"}}>
        {role==="buyer"&&tx.status==="active"&&!tx.reqId&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Подтвердить получение</button>}
        {role==="buyer"&&tx.status==="active"&&tx.reqId&&<div style={{fontSize:11,color:"#818cf8",padding:"7px 10px",background:"#6366f110",borderRadius:8,flex:1,textAlign:"center"}}>⏳ Ждём выполнения от исполнителя</div>}
        {role==="buyer"&&tx.status==="awaiting_confirm"&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Принять работу</button>}
        {role==="seller"&&tx.status==="active"&&tx.reqId&&<button onClick={()=>onMarkDone&&onMarkDone(tx.id)} style={{flex:1,background:"#1e3a5f",border:"1px solid #1d4ed8",color:"#60a5fa",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Выполнено</button>}
        {role==="seller"&&tx.status==="active"&&!tx.reqId&&<div style={{fontSize:11,color:T.text5,padding:"7px 10px",background:T.border,borderRadius:8,flex:1,textAlign:"center"}}>в работе у покупателя</div>}
        {role==="seller"&&tx.status==="awaiting_confirm"&&<div style={{fontSize:11,color:"#4ade80",padding:"7px 10px",background:"#4ade8010",borderRadius:8,flex:1,textAlign:"center"}}>✓ Ждём подтверждения заказчика</div>}
        {(tx.status==="active"&&!tx.reqId)||(tx.status==="active"&&role==="buyer"&&tx.reqId)
          ?<button onClick={()=>onCancelTx&&onCancelTx(tx.id)} style={{background:T.input,border:"1px solid #7f1d1d",color:"#f87171",padding:"7px 10px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отменить</button>
          :null}
      </div>}
      {tx.status==="confirmed"&&onReview&&(
        (reviews||[]).find(r=>r.txId===tx.id&&r.from===txMeId)
          ? <div style={{marginTop:7,fontSize:11,color:"#4ade80",padding:"5px 10px",background:"#4ade8010",borderRadius:8,textAlign:"center"}}>⭐ Отзыв оставлен</div>
          : <button onClick={()=>onReview(tx)} style={{marginTop:7,width:"100%",background:T.input,border:`1px solid ${T.border}`,color:T.text3,padding:"5px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⭐ Оставить отзыв</button>
      )}
    </div>;
  }

  const tabs = [{key:"get",l:"Жду получения"},{key:"give",l:"Мои обязательства"},{key:"reqs",l:"Мои запросы"}];
  return <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"'DM Sans',sans-serif"}} {...swipe}>
    <div style={{padding:"18px 20px 0"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
    </div>
    <div style={{padding:"12px 20px 0"}}>
      <div style={{fontSize:19,fontWeight:700,marginBottom:4,color:T.text}}>Мои задачи</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:7,marginBottom:14}}>
        {[
          {l:"Жду",v:iGetActive.length,c:"#fbbf24"},
          {l:"Выполню",v:iGiveActive.length,c:"#f97316"},
          {l:"Запросы",v:myReqs.filter(r=>r.status==="open").length,c:"#818cf8"},
          {l:"Отклики",v:myBidReqs.length,c:"#4ade80"},
        ].map((s,i)=><div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"8px 10px",textAlign:"center"}}>
          <div style={{fontSize:11,color:T.text4,marginBottom:2}}>{s.l}</div>
          <div style={{fontSize:18,fontWeight:700,color:s.v>0?s.c:T.text5}}>{s.v}</div>
        </div>)}
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:14,overflowX:"auto"}}>
        {tabs.map(t=><button key={t.key} onClick={()=>setCtab(t.key)} style={{background:"none",border:"none",padding:"10px 0",marginRight:14,fontSize:12,
          fontWeight:ctab===t.key?600:400,color:ctab===t.key?T.text:T.text4,
          borderBottom:ctab===t.key?`2px solid ${T.accent}`:"2px solid transparent",
          cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.l}</button>)}
      </div>
      {ctab==="get"&&<div>
        {iGetActive.length>0&&<><div style={{fontSize:12,color:"#fbbf24",fontWeight:600,marginBottom:8}}>⏳ Ожидаю ({iGetActive.length})</div>
          {iGetActive.map(tx=><TxCard key={tx.id} tx={tx} role="buyer" reviews={reviews} onReview={onReview} meId={meId}/>)}</>}
        {iGetDone.length>0&&<><div style={{fontSize:12,color:T.text4,marginTop:12,marginBottom:8}}>✓ Получено ({iGetDone.length})</div>
          {iGetDone.map(tx=><TxCard key={tx.id} tx={tx} role="buyer" reviews={reviews} onReview={onReview} meId={meId}/>)}</>}
        {iGetActive.length===0&&iGetDone.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"28px 0",fontSize:13}}>Нет покупок</div>}
      </div>}
      {ctab==="give"&&<div>
        {iGiveActive.length>0&&<><div style={{fontSize:12,color:"#f97316",fontWeight:600,marginBottom:8}}>⏳ Нужно выполнить ({iGiveActive.length})</div>
          {iGiveActive.map(tx=><TxCard key={tx.id} tx={tx} role="seller" reviews={reviews} onReview={onReview} meId={meId}/>)}</>}
        {myBidReqs.length>0&&<><div style={{fontSize:12,color:"#818cf8",fontWeight:600,marginTop:12,marginBottom:8}}>💬 Мои отклики</div>
          {myBidReqs.map(r=>{const bid=r.bids.find(b=>b.from===meId&&b.status==="pending");const auth=findM(members,r.member);
            return <div key={r.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{fontWeight:600,fontSize:14,color:T.text,marginBottom:4}}>{r.title}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.text3,marginBottom:8}}>
                <Avatar member={auth} size={18}/><span onClick={()=>onSelectMember(auth.id)} style={{cursor:"pointer",color:T.accent}}>{auth.name}</span>
                <span style={{marginLeft:"auto",color:"#818cf8",fontWeight:600}}>{cur(bid.price)}</span>
              </div>
              <button onClick={()=>onCancelBid&&onCancelBid(r.id,bid.id)}
                style={{width:"100%",background:"none",border:"1px solid #7f1d1d",color:"#f87171",
                  padding:"5px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                Отозвать отклик
              </button>
            </div>;})}
        </>}
        {iGiveDone.length>0&&<><div style={{fontSize:12,color:T.text4,marginTop:12,marginBottom:8}}>✓ Выполнено ({iGiveDone.length})</div>
          {iGiveDone.map(tx=><TxCard key={tx.id} tx={tx} role="seller" reviews={reviews} onReview={onReview} meId={meId}/>)}</>}
        {iGiveActive.length===0&&iGiveDone.length===0&&myBidReqs.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"28px 0",fontSize:13}}>Нет обязательств</div>}
      </div>}
      {ctab==="reqs"&&<div>
        {myReqs.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"28px 0",fontSize:13}}>Нет запросов</div>}
        {myReqs.map(r=>{const pb=r.bids.filter(b=>b.status==="pending").length;
          return <div key={r.id} style={{background:T.card,border:`1px solid ${r.status==="closed"?"#4ade8040":pb>0?"#f9713040":T.border}`,
            borderRadius:12,padding:"12px 14px",marginBottom:8,cursor:pb>0||r.status==="open"?"pointer":"default"}}
            onClick={()=>(pb>0||r.status==="open"||r.status==="in_progress")&&onOpenReq&&onOpenReq(r)}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontWeight:600,fontSize:14,color:T.text,flex:1}}>{r.title}</div>
              {pb>0&&<span style={{fontSize:11,background:"#f9713020",color:"#f97316",padding:"3px 9px",borderRadius:6,fontWeight:600,flexShrink:0}}>
                {pb} {pb===1?"предложение":"предложений"} →</span>}
              {r.status==="closed"&&<span style={{fontSize:11,color:"#4ade80",flexShrink:0}}>✓ выполнен</span>}
              {r.status==="in_progress"&&<span style={{fontSize:11,color:"#fbbf24",flexShrink:0}}>⏳ в работе</span>}
            </div>
            <div style={{fontSize:12,color:T.text3,marginBottom:5,lineHeight:1.4}}>{r.desc}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
              {r.budget&&<span style={{fontSize:11,color:"#fbbf24"}}>бюджет: {cur(r.budget)}</span>}
              {pb>0&&<span style={{fontSize:11,color:"#f97316"}}>Нажми чтобы принять →</span>}
              {r.status==="open"&&pb===0&&<button onClick={e=>{e.stopPropagation();onCancelRequest&&onCancelRequest(r.id);}}
                style={{fontSize:11,background:"none",border:`1px solid #7f1d1d`,color:"#f87171",
                  padding:"3px 10px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>
                Отменить</button>}
              {r.status==="cancelled"&&<span style={{fontSize:11,color:T.text5}}>отменён</span>}
            </div>
          </div>;})}
      </div>}
    </div>
  </div>;
}

export default MyTasksScreen;
