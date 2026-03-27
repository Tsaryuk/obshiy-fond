import { useState } from 'react';
import { Sheet, SL, FI, PB, Avatar } from '../ui';
import { CAT_ICONS, CUR, cur } from '../../lib/constants';
import { findM } from '../../lib/utils';

function RequestDetail({ request, members, meId, onAcceptBid, onDeclineBid, onBid, onClose, onChatWith, T }) {
  const author=findM(members,request.member);
  const isMe=request.member===meId;
  const myBid=request.bids.find(b=>b.from===meId);
  const canBid=!isMe&&(request.status==="open")&&!myBid;
  const [bidding,setBidding]=useState(false);
  const [bidPrice,setBidPrice]=useState(request.budget||"");
  const [bidNote,setBidNote]=useState("");
  return <Sheet T={T} onClose={onClose}>
    <div style={{display:"flex",gap:12,marginBottom:14}}>
      <div style={{width:46,height:46,borderRadius:12,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
        {CAT_ICONS[request.category]||"🙋"}</div>
      <div><div style={{fontWeight:700,fontSize:16}}>{request.title}</div>
        <div style={{fontSize:13,color:T.text3,marginTop:3}}>{request.desc}</div>
        {request.budget&&<div style={{fontSize:12,color:"#fbbf24",marginTop:4}}>Бюджет: до {cur(request.budget)}</div>}
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"8px 12px",background:T.border,borderRadius:10}}>
      <Avatar member={author} size={22} />
      <span style={{fontSize:13,color:T.text2}}>Запрос от {author.name}</span>
      <span style={{fontSize:11,color:T.text5,marginLeft:"auto",fontFamily:"monospace"}}>{request.date}</span>
    </div>
    <SL>Предложения ({request.bids.length})</SL>
    {request.bids.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"16px 0",marginBottom:8}}>Пока никто не откликнулся</div>}
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
      {request.bids.map(bid=>{
        const bidder=findM(members,bid.from);
        const ok=bid.status==="accepted",dec=bid.status==="declined";
        return <div key={bid.id} style={{background:T.card,border:`1px solid ${ok?"#4ade8040":dec?"#33415560":T.border}`,
          borderRadius:12,padding:"12px 14px",opacity:dec?0.4:1}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Avatar member={bidder} size={28} />
              <span style={{fontSize:13,fontWeight:600}}>{bidder.name}</span>
            </div>
            <span style={{fontSize:16,fontWeight:700,color:ok?"#4ade80":T.text}}>{cur(bid.price)}</span>
          </div>
          {bid.note&&<div style={{fontSize:12,color:T.text3,marginBottom:8,fontStyle:"italic"}}>«{bid.note}»</div>}
          {ok&&<div style={{fontSize:11,color:"#4ade80"}}>✓ Принято · сделка в реестре</div>}
          {isMe&&bid.status==="pending"&&<div style={{display:"flex",gap:8,marginTop:8}}>
            <PB v="green" onClick={()=>onAcceptBid(request.id,bid.id)} s={{padding:"7px"}}>✓ Принять</PB>
            <PB v="danger" onClick={()=>onDeclineBid(request.id,bid.id)} s={{padding:"7px"}}>Отклонить</PB>
          </div>}
        </div>;
      })}
    </div>
    {canBid&&!bidding&&<PB onClick={()=>setBidding(true)}>💬 Предложить свою цену</PB>}
    {!isMe&&onChatWith&&<PB T={T} v="ghost" s={{marginTop:8}} onClick={()=>{onChatWith(request.member,`💬 По запросу «${request.title}»`);onClose();}}>✉️ Написать автору</PB>}
    {myBid&&myBid.status==="pending"&&<div style={{fontSize:13,color:"#fbbf24",textAlign:"center",padding:"8px",background:"#fbbf2410",borderRadius:8}}>
      Ваше предложение: {cur(myBid.price)} — ожидает ответа</div>}
    {bidding&&<div style={{marginTop:10,padding:"14px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`}}>
      <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>Ваше предложение</div>
      <SL>Цена ({CUR.plural})</SL>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
        <input type="number" min="0" value={bidPrice} onChange={e=>setBidPrice(e.target.value)} placeholder={`Сколько ${CUR.plural}`}
          style={{flex:1,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"11px 14px",fontSize:16,fontFamily:"inherit",outline:"none"}} />
        {request.budget&&<div style={{fontSize:12,color:T.text3,textAlign:"right",flexShrink:0}}>
          <div>бюджет</div><div style={{color:"#fbbf24",fontWeight:600}}>{cur(request.budget)}</div></div>}
      </div>
      <SL>Комментарий</SL><FI T={T} value={bidNote} onChange={setBidNote} placeholder="Что предлагаешь…" multi />
      <div style={{display:"flex",gap:8}}>
        <PB onClick={()=>{onBid(request.id,Number(bidPrice),bidNote);setBidding(false);}} disabled={!bidPrice}>Отправить</PB>
        <PB v="ghost" onClick={()=>setBidding(false)} s={{flex:"0 0 80px"}}>Отмена</PB>
      </div>
    </div>}
    {request.status==="in_progress"&&<div style={{fontSize:13,color:"#fbbf24",textAlign:"center",padding:"10px",background:"#fbbf2410",borderRadius:8,marginTop:8}}>
      ⏳ Исполнитель принят · ждём выполнения
    </div>}
    {request.status==="closed"&&<div style={{fontSize:13,color:"#4ade80",textAlign:"center",padding:"10px",background:"#4ade8010",borderRadius:8,marginTop:8}}>
      ✓ Запрос закрыт · сделка состоялась
    </div>}
  </Sheet>;
}

export default RequestDetail;
