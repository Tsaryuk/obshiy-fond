import { Avatar } from "./ui";
import { findM } from "../lib/utils";

function ReviewsList({ reviews, members, T }) {
  if(!reviews||reviews.length===0) return (
    <div style={{textAlign:"center",color:"var(--color-text-faint)",padding:"18px 0",fontSize:13}}>Отзывов пока нет</div>
  );
  const avg = reviews.reduce((s,r)=>s+r.stars,0)/reviews.length;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",
        background:"var(--color-surface)",borderRadius:12,border:"1px solid var(--color-border)"}}>
        <div style={{fontSize:28,fontWeight:700,color:"var(--color-text-primary)"}}>{avg.toFixed(1)}</div>
        <div>
          <div style={{display:"flex",gap:2}}>
            {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:14,opacity:s<=Math.round(avg)?1:0.25}}>⭐</span>)}
          </div>
          <div style={{fontSize:11,color:"var(--color-text-muted)",marginTop:2}}>{reviews.length} {reviews.length===1?"отзыв":reviews.length<=4?"отзыва":"отзывов"}</div>
        </div>
      </div>
      {reviews.map((r,i)=>{
        const author = findM(members,r.from);
        return <div key={i} style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderRadius:12,
          padding:"11px 13px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Avatar member={author} size={28} />
              <div>
                <div style={{fontWeight:600,fontSize:13,color:"var(--color-text-primary)"}}>{author.name.split(" ")[0]}</div>
                <div style={{fontSize:10,color:"var(--color-text-faint)",fontFamily:"monospace"}}>{r.date}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:1}}>
              {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:12,opacity:s<=r.stars?1:0.2}}>⭐</span>)}
            </div>
          </div>
          {r.text&&<div style={{fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.4,fontStyle:"italic"}}>«{r.text}»</div>}
          <div style={{fontSize:11,color:"var(--color-text-faint)",marginTop:4}}>Сделка: {r.what}</div>
        </div>;
      })}
    </div>
  );
}

export default ReviewsList;
