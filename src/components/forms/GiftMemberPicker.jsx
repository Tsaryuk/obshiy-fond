import { useState } from 'react';
import { Avatar } from '../ui';
import { cur } from '../../lib/constants';

function GiftMemberPicker({ members, meId, giftTo, setGiftTo, balances, T }) {
  const [q, setQ] = useState("");
  const filtered = members.filter(m => m.id !== meId && !m.frozen &&
    (!q.trim() || m.name.toLowerCase().includes(q.toLowerCase()) ||
     (m.profession||"").toLowerCase().includes(q.toLowerCase())));
  const selected = members.find(m => m.id === giftTo);
  return (
    <div style={{marginBottom:12}}>
      {selected && <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
        borderRadius:10,background:"#6366f115",border:"1px solid #6366f140",marginBottom:8}}>
        <Avatar member={selected} size={32}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13,color:T.text}}>{selected.name}</div>
          <div style={{fontSize:11,color:T.text4}}>{selected.profession||"участник"}</div>
        </div>
        <span style={{fontSize:12,color:"#818cf8",fontWeight:600}}>{cur(balances[selected.id]||0)}</span>
        <button onClick={()=>setGiftTo(null)} style={{background:"none",border:"none",color:T.text4,fontSize:16,cursor:"pointer",padding:0}}>×</button>
      </div>}
      <div style={{position:"relative",marginBottom:8}}>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.text5,fontSize:13}}>🔍</span>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Найти участника…"
          style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
            color:T.text,padding:"9px 12px 9px 32px",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",
          background:"none",border:"none",color:T.text4,cursor:"pointer",fontSize:15}}>×</button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"12px 0",fontSize:13}}>Никого не найдено</div>}
        {filtered.map(m=><div key={m.id} onClick={()=>{setGiftTo(m.id);setQ("");}}
          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 11px",borderRadius:10,cursor:"pointer",
            background:giftTo===m.id?"#6366f115":T.input,border:`1px solid ${giftTo===m.id?"#6366f150":T.border}`}}
          onMouseEnter={e=>e.currentTarget.style.background=giftTo===m.id?"#6366f120":T.border}
          onMouseLeave={e=>e.currentTarget.style.background=giftTo===m.id?"#6366f115":T.input}>
          <Avatar member={m} size={28}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:500,color:T.text}}>{m.name}</div>
            {m.profession&&<div style={{fontSize:10,color:T.text4}}>{m.profession}</div>}
          </div>
          <span style={{fontSize:11,color:T.text4}}>{cur(balances[m.id]||0)}</span>
          {giftTo===m.id&&<span style={{color:"#818cf8",fontSize:14}}>✓</span>}
        </div>)}
      </div>
    </div>
  );
}

export default GiftMemberPicker;
