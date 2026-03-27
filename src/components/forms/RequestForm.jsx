import { useState } from 'react';
import { Sheet, SL, FI, PB } from '../ui';
import { CAT_ICONS, CATEGORIES, CUR } from '../../lib/constants';

function RequestForm({ onSave, onClose, T, categories: cats }) {
  const catList = cats||CATEGORIES;
  const [title,A]=useState(""); const [category,B]=useState("Все");
  const [desc,C]=useState(""); const [budget,D]=useState("");
  return <Sheet T={T} onClose={onClose}>
    <div style={{fontSize:17,fontWeight:700,marginBottom:6,color:T?.text}}>🙋 Новый запрос</div>
    <div style={{fontSize:13,color:T?.text3||"#475569",marginBottom:14}}>Опиши что ищёшь, укажи бюджет</div>
    <SL T={T}>Что нужно</SL><FI T={T} value={title} onChange={A} placeholder="Ищу, нужна…" />
    <SL T={T}>Категория</SL>
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
      {catList.map(c=>(
        <button key={c} onClick={()=>B(c)} style={{background:category===c?T?.accent||"#6366f1":T?.input||"#0d0f14",
          border:`1px solid ${category===c?T?.accent||"#6366f1":T?.border||"#1e2330"}`,color:category===c?"#fff":T?.text2||"#94a3b8",
          padding:"5px 11px",borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{CAT_ICONS[c]||"✦"} {c}</button>
      ))}
    </div>
    <SL T={T}>Бюджет ({CUR.plural})</SL>
    <FI T={T} type="number" value={budget} onChange={D} placeholder="Максимум (необязательно)" />
    <SL T={T}>Подробнее</SL><FI T={T} value={desc} onChange={C} placeholder="Детали, сроки…" multi />
    <PB T={T} onClick={()=>title.trim().length>3&&onSave({title,category,desc,budget:budget?Number(budget):null})} disabled={title.trim().length<=3}>Опубликовать</PB>
  </Sheet>;
}

export default RequestForm;
