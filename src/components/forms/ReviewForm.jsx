import { useState } from 'react';
import { Sheet, SL, FI, PB } from '../ui';
import { findM, today } from '../../lib/utils';
import { cur } from '../../lib/constants';

function ReviewForm({ tx, members, meId, onSave, onClose, T }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const isOut = tx.from === meId;
  const other = isOut ? findM(members, tx.to) : findM(members, tx.from);
  return (
    <Sheet onClose={onClose}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4,color:"var(--color-text-primary)"}}>Оставить отзыв</div>
      <div style={{fontSize:13,color:"var(--color-text-tertiary)",marginBottom:14}}>
        Сделка: <span style={{color:"var(--color-text-secondary)",fontWeight:500}}>{tx.what}</span>
        {" · "}<span style={{color:"#6366f1",cursor:"pointer"}}>{other.name}</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,justifyContent:"center"}}>
        {[1,2,3,4,5].map(s=>(
          <div key={s} onClick={()=>setStars(s)}
            style={{fontSize:30,cursor:"pointer",opacity:s<=stars?1:0.25,transition:"opacity 0.1s"}}>⭐</div>
        ))}
      </div>
      <SL>Комментарий (необязательно)</SL>
      <FI value={text} onChange={setText} placeholder="Как прошла сделка?" multi />
      <PB onClick={()=>onSave({txId:tx.id,from:meId,to:other.id,stars,text,date:today(),what:tx.what})}>
        Опубликовать отзыв
      </PB>
    </Sheet>
  );
}

export default ReviewForm;
