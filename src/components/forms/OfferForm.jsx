import { useState, useRef } from 'react';
import { Sheet, SL, FI, PB } from '../ui';
import { CAT_ICONS, CATEGORIES } from '../../lib/constants';

function OfferForm({ initial, onSave, onClose, T, categories: cats }) {
  const catList = (cats||CATEGORIES).filter(c=>c!=="Все");
  const [title,A]=useState(initial?.title??""); const [category,B]=useState(initial?.category??(catList[0]||"Еда"));
  const [price,C]=useState(initial?.price??0); const [unit,D]=useState(initial?.unit??"раз");
  const [qty,E]=useState(initial?.qty??1); const [desc,F]=useState(initial?.desc??"");
  const [photo,G]=useState(initial?.photo??null);
  const photoRef=useRef();
  const ok=title.trim().length>2;
  function handlePhoto(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>G(ev.target.result);r.readAsDataURL(f);}
  return <Sheet T={T} onClose={onClose}>
    <div style={{fontSize:17,fontWeight:700,marginBottom:14,color:T?.text}}>{initial?"Редактировать":"Новое предложение"}</div>
    {/* PHOTO */}
    <SL T={T}>Фото (необязательно)</SL>
    <div style={{marginBottom:11}}>
      {photo
        ? <div style={{position:"relative"}}>
            <img src={photo} alt="" style={{width:"100%",height:140,objectFit:"cover",borderRadius:10,border:`1px solid ${T?.border||"#1e2330"}`}} />
            <button onClick={()=>G(null)} style={{position:"absolute",top:6,right:6,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        : <div onClick={()=>photoRef.current.click()} style={{height:86,background:T?.input||"#0d0f14",border:`2px dashed ${T?.border2||"#2d3548"}`,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,cursor:"pointer",color:T?.text4||"#475569",fontSize:13}}>
            <span style={{fontSize:22}}>📷</span><span>Добавить фото</span>
          </div>
      }
      <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} />
    </div>
    <SL T={T}>Название</SL><FI T={T} value={title} onChange={A} placeholder="Что предлагаешь?" />
    <SL T={T}>Категория</SL>
    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
      {catList.map(c=>(
        <button key={c} onClick={()=>B(c)} style={{background:category===c?T?.accent||"#6366f1":T?.input||"#0d0f14",
          border:`1px solid ${category===c?T?.accent||"#6366f1":T?.border||"#1e2330"}`,color:category===c?"#fff":T?.text2||"#94a3b8",
          padding:"5px 11px",borderRadius:20,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{CAT_ICONS[c]||"◎"} {c}</button>
      ))}
    </div>
    <SL T={T}>Цена / Кол-во / Единица</SL>
    <div style={{display:"flex",gap:7,marginBottom:11,width:"100%",boxSizing:"border-box"}}>
      <input type="number" min="0" value={price} onChange={e=>C(Number(e.target.value))} placeholder="0"
        style={{width:0,flex:2,minWidth:0,background:T?.input||"#0d0f14",border:`1px solid ${T?.border||"#1e2330"}`,borderRadius:10,color:T?.text||"#e2e8f0",padding:"10px 8px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
      <input type="number" min="1" value={qty} onChange={e=>E(Number(e.target.value))} placeholder="кол-во"
        style={{width:0,flex:2,minWidth:0,background:T?.input||"#0d0f14",border:`1px solid ${T?.border||"#1e2330"}`,borderRadius:10,color:T?.text||"#e2e8f0",padding:"10px 8px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
      <input value={unit} onChange={e=>D(e.target.value)} placeholder="раз"
        style={{width:0,flex:2,minWidth:0,background:T?.input||"#0d0f14",border:`1px solid ${T?.border||"#1e2330"}`,borderRadius:10,color:T?.text||"#e2e8f0",padding:"10px 8px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
    </div>
    <SL T={T}>Описание</SL><FI T={T} value={desc} onChange={F} placeholder="Расскажи подробнее…" multi />
    <PB T={T} onClick={()=>ok&&onSave({title,category,price,unit,qty,desc,photo})} disabled={!ok}>{initial?"Сохранить":"Добавить в фонд"}</PB>
  </Sheet>;
}

export default OfferForm;
