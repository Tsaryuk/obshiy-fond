import { useEffect } from "react";

function Lightbox({ src, onClose }) {
  useEffect(()=>{
    const h=(e)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose]);
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,
    display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:16}}>
    <img src={src} alt="" onClick={e=>e.stopPropagation()}
      style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:14,boxShadow:"0 24px 80px rgba(0,0,0,0.8)",objectFit:"contain"}} />
    <button onClick={onClose} style={{position:"fixed",top:16,right:16,width:36,height:36,borderRadius:"50%",
      background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",
      display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
  </div>;
}

export default Lightbox;
