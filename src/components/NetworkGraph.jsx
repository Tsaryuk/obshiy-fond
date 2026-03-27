import { useRef, useEffect, useState } from "react";
import { AV_COLORS } from "../lib/constants";

function NetworkGraph({ members, transactions, invites, onSelectMember }) {
  const canvasRef=useRef(); const animRef=useRef(); const nodesRef=useRef([]);
  const [hovered,setHovered]=useState(null);
  const W=420,H=340;
  const weight={};
  members.forEach(m=>{weight[m.id]=1;});
  transactions.filter(t=>t.status==="confirmed").forEach(t=>{
    if(t.from>0)weight[t.from]=(weight[t.from]||1)+0.5;
    if(t.to>0)weight[t.to]=(weight[t.to]||1)+0.5;
  });
  const edges=[];
  invites.filter(i=>i.usedBy&&i.createdBy).forEach(i=>{edges.push({a:i.createdBy,b:i.usedBy,type:"invite"});});
  transactions.filter(t=>t.status==="confirmed"&&t.type==="exchange"&&t.from&&t.to).forEach(t=>{
    if(!edges.find(e=>(e.a===t.from&&e.b===t.to)||(e.a===t.to&&e.b===t.from)))edges.push({a:t.from,b:t.to,type:"tx"});
  });
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");canvas.width=W;canvas.height=H;
    nodesRef.current=members.map((m,i)=>({...m,vx:0,vy:0,r:Math.min(28,14+(weight[m.id]||1)*3),
      x:W/2+Math.cos(i/members.length*Math.PI*2)*120,y:H/2+Math.sin(i/members.length*Math.PI*2)*100}));
    const nodes=nodesRef.current;
    function tick(){
      nodes.forEach(n=>{
        nodes.forEach(o=>{if(o===n)return;const dx=n.x-o.x,dy=n.y-o.y,d=Math.sqrt(dx*dx+dy*dy)||1;const f=800/(d*d);n.vx+=dx/d*f;n.vy+=dy/d*f;});
        n.vx+=(W/2-n.x)*0.002;n.vy+=(H/2-n.y)*0.002;
        edges.forEach(e=>{if(e.a!==n.id&&e.b!==n.id)return;const o=nodes.find(x=>x.id===(e.a===n.id?e.b:e.a));if(!o)return;
          const dx=o.x-n.x,dy=o.y-n.y,d=Math.sqrt(dx*dx+dy*dy)||1;const t=e.type==="invite"?140:100,f=(d-t)*0.015;n.vx+=dx/d*f;n.vy+=dy/d*f;});
        n.vx*=0.8;n.vy*=0.8;n.x=Math.max(n.r+4,Math.min(W-n.r-4,n.x+n.vx));n.y=Math.max(n.r+4,Math.min(H-n.r-4,n.y+n.vy));
      });
      ctx.clearRect(0,0,W,H);ctx.fillStyle="#0d0f14";ctx.fillRect(0,0,W,H);
      edges.forEach(e=>{const a=nodes.find(n=>n.id===e.a),b=nodes.find(n=>n.id===e.b);if(!a||!b)return;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=e.type==="invite"?"#6366f150":"#22c55e40";ctx.lineWidth=e.type==="invite"?1.5:1;
        ctx.setLineDash(e.type==="invite"?[4,4]:[]);ctx.stroke();ctx.setLineDash([]);});
      nodes.forEach(n=>{const isH=hovered===n.id;const idH=String(n.id).split("").reduce((a,c)=>a+c.charCodeAt(0),0);const bg=AV_COLORS[idH%AV_COLORS.length];
        if(isH){ctx.beginPath();ctx.arc(n.x,n.y,n.r+7,0,Math.PI*2);ctx.fillStyle=bg+"30";ctx.fill();}
        ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fillStyle=bg;ctx.fill();
        if(isH){ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();}
        ctx.fillStyle="#fff";ctx.font=`bold ${Math.max(9,n.r*0.45)}px DM Sans,sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
        const initials=(n.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
        ctx.fillText(initials,n.x,n.y);
        if(isH){const nm=n.name.split(" ")[0];ctx.font="600 12px DM Sans,sans-serif";
          const tw=ctx.measureText(nm).width+12;ctx.fillStyle="#131720dd";
          ctx.fillRect(n.x-tw/2,n.y+n.r+4,tw,18);ctx.fillStyle="#e2e8f0";ctx.fillText(nm,n.x,n.y+n.r+13);}
      });
      animRef.current=requestAnimationFrame(tick);
    }
    tick();return()=>cancelAnimationFrame(animRef.current);
  },[members,invites,transactions,hovered]);
  function onMove(e){const rect=canvasRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);
    const hit=nodesRef.current.find(n=>Math.hypot(n.x-mx,n.y-my)<n.r+4);setHovered(hit?hit.id:null);}
  function onClick(e){const rect=canvasRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);
    const hit=nodesRef.current.find(n=>Math.hypot(n.x-mx,n.y-my)<n.r+4);if(hit&&onSelectMember)onSelectMember(hit.id);}
  return <div><canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={()=>setHovered(null)} onClick={onClick}
    style={{width:"100%",borderRadius:14,border:"1px solid #1e2330",cursor:hovered?"pointer":"default"}} />
    <div style={{display:"flex",gap:14,marginTop:8,fontSize:11,color:"#475569"}}>
      <span>╌╌ инвайт</span><span style={{color:"#22c55e"}}>── сделка</span><span>нажми на участника →</span>
    </div></div>;
}

export default NetworkGraph;
