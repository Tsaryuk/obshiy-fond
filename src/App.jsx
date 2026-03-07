import { useState, useRef, useEffect, useCallback } from "react";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPA_URL = "https://ecddhpgfdapuxfrlrszo.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZGRocGdmZGFwdXhmcmxyc3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDIxMDIsImV4cCI6MjA4ODM3ODEwMn0.UlaL7U_4zcuKyPqMjImRERvlU0f6vy9SY0gGb945o6U";

// Minimal Supabase REST client (no npm needed — works in Babel/CDN)
const sb = {
  _h: () => ({ "Content-Type":"application/json", "apikey": SUPA_KEY, "Authorization":"Bearer "+SUPA_KEY, "Prefer":"return=representation" }),

  async select(table, params="") {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers: sb._h() });
    if(!r.ok) { const e=await r.text(); console.error("sb.select",table,e); return []; }
    return r.json();
  },

  async insert(table, row) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method:"POST", headers: sb._h(), body: JSON.stringify(row)
    });
    if(!r.ok) { const e=await r.text(); console.error("sb.insert",table,e); return null; }
    const d=await r.json(); return Array.isArray(d)?d[0]:d;
  },

  async update(table, match, data) {
    const q = Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&");
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${q}`, {
      method:"PATCH", headers: sb._h(), body: JSON.stringify(data)
    });
    if(!r.ok) { const e=await r.text(); console.error("sb.update",table,e); }
  },

  async upsert(table, row, onConflict) {
    const h = { ...sb._h(), "Prefer": "resolution=merge-duplicates,return=representation" };
    if(onConflict) h["on_conflict"] = onConflict;
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict||"id"}`, {
      method:"POST", headers: h, body: JSON.stringify(row)
    });
    if(!r.ok) { const e=await r.text(); console.error("sb.upsert",table,e); return null; }
    const d=await r.json(); return Array.isArray(d)?d[0]:d;
  },

  async delete(table, match) {
    const q = Object.entries(match).map(([k,v])=>`${k}=eq.${encodeURIComponent(v)}`).join("&");
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${q}`, {
      method:"DELETE", headers: sb._h()
    });
    if(!r.ok) { const e=await r.text(); console.error("sb.delete",table,e); }
  },

  // Realtime via SSE
  channel(table, cb) {
    const url = `${SUPA_URL}/realtime/v1/api/broadcast`;
    // Use polling as fallback (simpler, no websocket needed for MVP)
    return setInterval(cb, 3000);
  }
};

// ─── ID GENERATOR ─────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);

// ─── DB → APP shape converters ────────────────────────────────────────────────
const toMember = (r) => r ? ({
  id: r.id, name: r.name, profession: r.profession||"", bio: r.bio||"",
  photo: r.photo||null, telegram: r.telegram||null, instagram: r.instagram||null,
  joined: r.joined||"2025-03", invitedBy: r.invited_by||null,
  systemRole: r.system_role||"member", frozen: r.frozen||false,
  helpful: r.helpful||"", avatar: (r.name||"").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()
}) : null;

const toOffer = (r) => r ? ({
  id: r.id, member: r.member, title: r.title, category: r.category||"Услуги",
  price: Number(r.price)||0, unit: r.unit||"раз", qty: Number(r.qty)||1,
  reserved: Number(r.reserved)||0, available: r.available!==false,
  desc: r.description||"", photo: r.photo||null
}) : null;

const toRequest = (r, bids=[]) => r ? ({
  id: r.id, member: r.member, title: r.title, category: r.category||"Все",
  desc: r.description||"", budget: r.budget?Number(r.budget):null,
  status: r.status||"open", acceptedBidId: r.accepted_bid_id||null,
  bids: bids.filter(b=>b.request_id===r.id).map(toMBid)
}) : null;

const toMBid = (b) => b ? ({
  id: b.id, from: b.from_member, price: Number(b.price)||0,
  note: b.note||"", status: b.status||"pending"
}) : null;

const toTx = (r) => r ? ({
  id: r.id, type: r.type, from: r.from_member, to: r.to_member,
  amount: Number(r.amount)||0, qty: Number(r.qty)||1, what: r.what||"",
  date: r.date||r.created_at||"", status: r.status||"pending",
  offerId: r.offer_id||null, reqId: r.req_id||null
}) : null;

const toReview = (r) => r ? ({
  id: r.id, txId: r.tx_id, from: r.from_member, to: r.to_member,
  stars: r.stars, text: r.body||"", date: r.date||""
}) : null;

const toMsg = (r) => r ? ({
  id: r.id, from: r.from_member, to: r.to_member,
  text: r.body||"", time: r.date||"", isGroup: r.is_group||false, read: r.read||false
}) : null;

const toNotif = (r) => r ? ({
  id: r.id, memberId: r.member_id, type: r.type,
  text: r.body||"", date: r.date||"", read: r.read||false
}) : null;

const toInvite = (r) => r ? ({
  id: r.id, code: r.code, createdBy: r.created_by,
  usedBy: r.used_by||null, usedAt: r.used_at||null, createdAt: r.created_at||""
}) : null;


// ─── CURRENCY ─────────────────────────────────────────────────────────────────
const CUR = { name:"зерно", plural:"зёрен", few:"зерна", sign:"з" };
const cur = (n) => {
  const abs=Math.abs(n);
  if(abs===1) return `${n} ${CUR.name}`;
  if(abs>=2&&abs<=4) return `${n} ${CUR.few}`;
  return `${n} ${CUR.plural}`;
};

// ─── ROLES ────────────────────────────────────────────────────────────────────
const ROLES = { admin:"admin", moderator:"moderator", member:"member" };
const ROLE_LABEL = { admin:"Администратор", moderator:"Модератор", member:"Участник" };
const ROLE_COLOR = { admin:"#fbbf24", moderator:"#818cf8", member:"#4ade80" };
const canAdmin = (r) => r===ROLES.admin;
const canModerate = (r) => r===ROLES.admin||r===ROLES.moderator;

// ─── AUTH & SEED DATA loaded from Supabase ────────────────────────────────────
const INIT_OFFERS = [];
const INIT_TRANSACTIONS = [];

function initBalances(members, txs) {
  const b = Object.fromEntries(members.map(m=>[m.id,0]));
  txs.filter(t=>t.status==="confirmed"||t.status==="active").forEach(t=>{
    if(t.from>0) b[t.from]=(b[t.from]||0)-t.amount;
    if(t.to>0)   b[t.to]=(b[t.to]||0)+t.amount;
  });
  return b;
}

const INIT_REQUESTS = [];
const INIT_INVITES = [];
const INIT_NEWS = [];
const INIT_NOTIFICATIONS = [];

const CATEGORIES = ["Все","Еда","Жильё","Здоровье","Знания","Транспорт","Дети","Культура"];
const APP_VERSION = "1.6";
const VersionFooter = ({T}) => <div style={{textAlign:"center",padding:"16px 0 8px",fontSize:10,color:T?.text5||"#1e2330",opacity:0.6,fontFamily:"monospace"}}>Общий фонд · v{APP_VERSION}</div>;

let CAT_ICONS = {"Еда":"🌿","Жильё":"🏠","Здоровье":"💙","Знания":"📖","Транспорт":"🚗","Дети":"🌱","Культура":"🎵","Все":"✦"};
const AV_COLORS = ["#7c6ff7","#f97316","#22c55e","#ec4899","#06b6d4","#eab308"];

// ─── THEME ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:"#0d0f14", card:"#131720", border:"#1e2330", border2:"#2d3548",
    text:"#e2e8f0", text2:"#94a3b8", text3:"#64748b", text4:"#475569", text5:"#334155",
    input:"#0d0f14", accent:"#6366f1",
  },
  light: {
    bg:"#f1f5f9", card:"#ffffff", border:"#e2e8f0", border2:"#cbd5e1",
    text:"#0f172a", text2:"#334155", text3:"#475569", text4:"#64748b", text5:"#94a3b8",
    input:"#f8fafc", accent:"#6366f1",
  }
};

// ─── WALLET & POTENTIAL ───────────────────────────────────────────────────────
const walletNum = (id, joined) => {
  const yymm = (joined||"2024-03").replace("-","").slice(0,6);
  const num = String(id).replace(/\D/g,"") || String(id);
  return `ОФ-${yymm}-${num.padStart(4,"0")}`;
};
const payPotential = (memberId, offers, balance) => {
  const offSum = offers
    .filter(o => o.member===memberId && o.available && (o.qty-o.reserved)>0 && o.price>0)
    .reduce((s,o) => s + o.price*(o.qty-o.reserved), 0);
  return balance + offSum;
};

// ─── SEARCH ───────────────────────────────────────────────────────────────────
const CAT_SYNONYMS = {
  "Еда":       ["еда","food","продукт","продукты","овощ","фрукт","мясо","масло","варенье","томат","помидор","сад","огород","рынок","закупка"],
  "Жильё":     ["жильё","жилье","ремонт","дом","квартира","розетк","кран","полк","мебель","сантехник","электрик"],
  "Здоровье":  ["здоровье","медицина","зуб","зубн","врач","помощь","стоматолог","аптечк","осмотр"],
  "Знания":    ["знания","обучение","урок","репетитор","музык","гитар","фортепиан","математик","педагог","занятие"],
  "Транспорт": ["транспорт","подвезти","машина","авто","поездк","подвоз"],
  "Дети":      ["дети","ребёнок","ребенок","коляск","детск","сын","дочь","малыш"],
  "Культура":  ["культура","искусство","театр","кино","музей"],
};
function matchSearch(offer, query) {
  if(!query) return true;
  const q = query.toLowerCase().trim();
  const text = [offer.title, offer.desc, offer.category].join(" ").toLowerCase();
  if(text.includes(q)) return true;
  // synonym matching: if query matches a category or its synonyms
  for(const [cat, syns] of Object.entries(CAT_SYNONYMS)) {
    const qMatchesCat = syns.some(s => q.includes(s) || s.startsWith(q));
    if(qMatchesCat && (offer.category===cat || syns.some(s=>text.includes(s)))) return true;
  }
  return false;
}

const balColor = (b,T) => b>50?"#4ade80":b<-50?"#f87171":(T?.text2||"#94a3b8");
const findM = (members,id) => members.find(m=>m.id===id)||{name:"Фонд",avatar:"∞",id:0,systemRole:ROLES.member};
const genCode = () => "FOND-"+Math.random().toString(36).slice(2,6).toUpperCase();
const today = () => new Date().toISOString().slice(0,10);
const S_LABEL = { active:"в работе", awaiting_confirm:"ожидает подтверждения", confirmed:"завершена", cancelled:"отменена" };
const S_COLOR = { active:"#f97316", awaiting_confirm:"#818cf8", confirmed:"#4ade80", cancelled:"#475569" };

// ─── ДЕМЕРЕДЖ (ПЛАТА ЗА ХРАНЕНИЕ) ────────────────────────────────────────────
const DEMURRAGE_RATE = 0.02;  // 2% в месяц
const DEMURRAGE_THRESHOLD = 50; // порог: демередж только на сумму выше 50 зёрен
const DEFAULT_NEG_LIMIT = -150; // лимит отрицательного баланса по умолчанию
// Рассчитать демередж за период
function calcDemurrage(balance, monthsHeld) {
  if(balance <= DEMURRAGE_THRESHOLD) return 0;
  const taxableAmount = balance - DEMURRAGE_THRESHOLD;
  return Math.floor(taxableAmount * DEMURRAGE_RATE * monthsHeld * 10) / 10;
}
// Применить демередж к балансу (используется при отображении)
function getEffectiveBalance(memberId, balances, transactions) {
  const raw = balances[memberId] || 0;
  if(raw <= 0) return raw;
  // Найти дату последней активности
  const memberTxs = transactions.filter(t => (t.from===memberId||t.to===memberId) && t.status==="confirmed");
  if(memberTxs.length === 0) return raw;
  const lastDate = memberTxs.map(t=>t.date).sort().reverse()[0];
  const today = new Date().toISOString().slice(0,10);
  const months = Math.max(0, (new Date(today) - new Date(lastDate)) / (1000*60*60*24*30));
  const demurrage = calcDemurrage(raw, months);
  return Math.max(0, raw - demurrage);
}


// ─── SWIPE HOOK ───────────────────────────────────────────────────────────────
function useSwipe(onSwipeRight, onSwipeLeft) {
  const startX = useRef(null);
  const onTouchStart = useCallback(e => { startX.current = e.touches[0].clientX; }, []);
  const onTouchEnd = useCallback(e => {
    if(startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if(Math.abs(dx) > 60) { dx > 0 ? onSwipeRight?.() : onSwipeLeft?.(); }
    startX.current = null;
  }, [onSwipeRight, onSwipeLeft]);
  return { onTouchStart, onTouchEnd };
}

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Avatar({ member, size=36 }) {
  const idHash = String(member.id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const bg = AV_COLORS[idHash % AV_COLORS.length];
  const initials = (member.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  if(member.photo) return <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
    <img src={member.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /></div>;
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,flexShrink:0,
    display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:size*0.33,fontWeight:700,color:"#fff",letterSpacing:"-0.5px"}}>{initials}</div>;
}

function Pill({ balance, T }) {
  const c = balColor(balance, T);
  return <span style={{background:`${c}18`,color:c,padding:"2px 10px",
    borderRadius:20,fontSize:13,fontWeight:600,border:`1px solid ${c}30`}}>
    {balance>0?"+":""}{cur(balance)}</span>;
}

function RoleBadge({ role }) {
  if(!role||role===ROLES.member) return null;
  return <span style={{fontSize:10,background:`${ROLE_COLOR[role]}20`,color:ROLE_COLOR[role],
    padding:"1px 7px",borderRadius:8,border:`1px solid ${ROLE_COLOR[role]}30`}}>
    {ROLE_LABEL[role]}</span>;
}

function QtyBar({ qty, reserved, T }) {
  const avail=qty-reserved, pct=qty>0?(avail/qty)*100:0;
  const c=pct>50?"#4ade80":pct>20?"#fbbf24":"#f87171";
  return <div style={{marginTop:8}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T?.text3||"#64748b",marginBottom:3}}>
      <span>Доступно: <b style={{color:c}}>{avail}</b> из {qty}</span>
      {reserved>0&&<span style={{color:"#fbbf24"}}>забронировано: {reserved}</span>}
    </div>
    <div style={{height:3,background:T?.border||"#1e2330",borderRadius:2}}>
      <div style={{height:"100%",borderRadius:2,background:c,width:`${pct}%`,transition:"width 0.3s"}} /></div>
  </div>;
}

function Sheet({ onClose, children, T }) {
  const bg = T?.card||"#131720"; const br = T?.border||"#1e2330";
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef(null);

  const doClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 260);
  }, [onClose]);

  const onTouchStart = useCallback(e => { e.stopPropagation(); startY.current = e.touches[0].clientY; }, []);
  const onTouchMove = useCallback(e => {
    e.stopPropagation();
    if(startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if(dy > 0) { try{e.preventDefault();}catch(_){} setDragY(dy); }
  }, []);
  const onTouchEnd = useCallback(e => {
    e.stopPropagation();
    if(startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if(dy > 60) { setDragY(0); doClose(); }
    else setDragY(0);
    startY.current = null;
  }, [doClose]);

  const progress = Math.min(dragY / 120, 1);
  const sheetStyle = {
    background: bg, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px",
    width: "100%", border: `1px solid ${br}`,
    animation: closing ? "slideOut 0.26s ease forwards" : "slideIn 0.25s ease",
    maxHeight: "90vh", overflowY: "auto", color: T?.text||"#e2e8f0",
    transform: `translateY(${dragY}px)`,
    transition: dragY === 0 ? "transform 0.2s ease" : "none",
  };

  return <div style={{position:"fixed",inset:0,
    background:`rgba(0,0,0,${0.75 - progress * 0.5})`,
    display:"flex",alignItems:"flex-end",zIndex:200,backdropFilter:`blur(${4 - progress*4}px)`,
    transition: dragY===0 ? "background 0.2s" : "none"}}
    onClick={e=>e.target===e.currentTarget&&doClose()}>
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={sheetStyle}>
      <div style={{width:36,height:4,background:br,borderRadius:2,margin:"0 auto 20px",
        opacity: 1 - progress * 0.5}} />
      {children}
    </div>
  </div>;
}

function SL({ children, mt=0, T }) {
  return <div style={{fontSize:11,color:T?.text4||"#475569",letterSpacing:1.5,textTransform:"uppercase",
    marginBottom:8,marginTop:mt}}>{children}</div>;
}
function IRow({ label, children, T }) {
  return <div style={{background:T?.input||"#0d0f14",borderRadius:12,padding:"11px 14px",marginBottom:10,
    display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${T?.border||"#1e2330"}`}}>
    <span style={{fontSize:13,color:T?.text3||"#64748b"}}>{label}</span>{children}</div>;
}
function FI({ value, onChange, placeholder, multi, type="text", s={}, T }) {
  const base={width:"100%",background:T?.input||"#0d0f14",border:`1px solid ${T?.border||"#1e2330"}`,borderRadius:10,
    color:T?.text||"#e2e8f0",padding:"11px 14px",fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:11,...s};
  return multi
    ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...base,resize:"none",height:68}} />
    : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base} />;
}
function PB({ onClick, children, v="primary", s={}, disabled=false, T }) {
  const acc = T?.accent||"#4f46e5";
  const vs={
    primary:{background:acc,color:"#fff",border:"none"},
    gold:   {background:"#78350f",color:"#fbbf24",border:"1px solid #92400e"},
    ghost:  {background:T?.card||"#1e2330",color:T?.text2||"#94a3b8",border:`1px solid ${T?.border||"#2d3548"}`},
    danger: {background:"#1a0d0d",color:"#f87171",border:"1px solid #7f1d1d"},
    green:  {background:"#052e16",color:"#4ade80",border:"1px solid #166534"},
    orange: {background:"#431407",color:"#f97316",border:"1px solid #7c2d12"},
  };
  return <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"12px",borderRadius:12,
    fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",
    opacity:disabled?0.4:1,...vs[v],...s}}>{children}</button>;
}
function Notif({ msg }) {
  return <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
    background:"#1e2330",border:"1px solid #2d3548",padding:"10px 20px",borderRadius:12,
    zIndex:1000,fontSize:14,fontWeight:500,color:"#e2e8f0",animation:"notif 2.8s ease forwards",
    whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>{msg}</div>;
}

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────
function CopyBtn({ text, T }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
    } else {
      // Fallback for non-HTTPS / Safari
      const el = document.createElement('textarea');
      el.value = text; el.style.position='fixed'; el.style.opacity='0';
      document.body.appendChild(el); el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch(e){}
      document.body.removeChild(el);
    }
  }
  return <button onClick={doCopy}
    style={{background:copied?"#052e16":T?.border,border:`1px solid ${copied?"#166534":"transparent"}`,
      color:copied?"#4ade80":"#6366f1",padding:"5px 10px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
    {copied?"✓ Скопировано":"Копировать"}
  </button>;
}


// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen({ invites, members, accounts, onLogin, onRegister, T: T_prop }) {
  const T = T_prop || THEMES.dark;
  const [mode,    setMode]    = useState("login");
  const [login,   setLogin]   = useState("");
  const [pass,    setPass]    = useState("");
  const [showP,   setShowP]   = useState(false);
  const [error,   setError]   = useState("");
  const [invCode, setInvCode] = useState("");
  const [rName,   setRName]   = useState("");
  const [rLogin,  setRLogin]  = useState("");
  const [rPass,   setRPass]   = useState("");
  const [rProf,   setRProf]   = useState("");
  const [rBio,    setRBio]    = useState("");
  const [rTg,     setRTg]     = useState("");
  const [step,    setStep]    = useState(1);
  const [registering, setRegistering] = useState(false);

  function doLogin() {
    const acc=accounts.find(a=>a.login===login.toLowerCase().trim()&&a.password===pass);
    if(!acc){setError("Неверный логин или пароль");return;}
    const m=members.find(m=>m.id===acc.memberId);
    if(m?.frozen){setError("Аккаунт заморожен. Обратитесь к администратору");return;}
    onLogin(acc.memberId);
  }
  function checkInvite() {
    const inv=invites.find(i=>i.code===invCode.trim().toUpperCase()&&!i.usedBy);
    if(!inv){setError("Инвайт не найден или уже использован");return;}
    setError(""); setStep(2);
  }
  function doRegister() {
    if(registering) return;
    if(!rName.trim()||!rLogin.trim()||!rPass.trim()){setError("Заполни все поля");return;}
    if(!/^[a-z0-9_]+$/.test(rLogin)){setError("Логин: только латинские буквы и цифры");return;}
    if(accounts.find(a=>a.login===rLogin.toLowerCase().trim())){setError("Логин занят");return;}
    setRegistering(true);
    onRegister({invCode:invCode.trim().toUpperCase(),name:rName,login:rLogin.toLowerCase().trim(),
      password:rPass,profession:rProf,bio:rBio,telegram:rTg});
  }

  return <div style={{minHeight:"100vh",background:T.bg,color:T.text,
    fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column",
    alignItems:"center",justifyContent:"center",padding:"24px",maxWidth:480,margin:"0 auto"}}>
    <style>{GCSS}</style>
    <div style={{marginBottom:28,textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:8}}>🌾</div>
      <div style={{fontSize:26,fontWeight:700,letterSpacing:"-0.5px"}}>Общий фонд</div>
      <div style={{fontSize:13,color:T.text4,marginTop:4}}>Сообщество взаимного обмена</div>
    </div>
    {mode==="login"&&<div style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"24px 20px"}}>
      <div style={{fontSize:18,fontWeight:700,marginBottom:18}}>Войти</div>
      <SL>Логин</SL><FI T={T} value={login} onChange={v=>{setLogin(v.replace(/[^a-z0-9_]/g,"").toLowerCase());setError("");}} placeholder="login" />
      <SL>Пароль</SL>
      <div style={{position:"relative",marginBottom:11}}>
        <input type={showP?"text":"password"} value={pass} onChange={e=>{setPass(e.target.value);setError("");}} placeholder="••••••••"
          style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
            color:T.text,padding:"11px 40px 11px 14px",fontSize:14,fontFamily:"inherit",outline:"none"}} />
        <button onClick={()=>setShowP(!showP)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
          background:"none",border:"none",color:T.text4,cursor:"pointer",fontSize:14}}>{showP?"🙈":"👁"}</button>
      </div>
      {error&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{error}</div>}
      <PB onClick={doLogin} disabled={!login||!pass}>Войти</PB>
      <div style={{textAlign:"center",marginTop:12,fontSize:13,color:T.text4}}>
        Нет аккаунта?{" "}<span onClick={()=>{setMode("register");setError("");setStep(1);}} style={{color:"#6366f1",cursor:"pointer"}}>Зарегистрироваться</span>
      </div>

    </div>}

    {mode==="register"&&<div style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"24px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        {step>1&&<button onClick={()=>setStep(step-1)} style={{background:"none",border:"none",color:T.text4,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0}}>←</button>}
        <div style={{fontSize:18,fontWeight:700}}>{step===1?"Инвайт":step===2?"О себе":"Аккаунт"}</div>
        <div style={{marginLeft:"auto",display:"flex",gap:5}}>
          {[1,2,3].map(i=><div key={i} style={{width:i<=step?18:7,height:5,borderRadius:3,background:i<=step?"#6366f1":T.border,transition:"all 0.2s"}} />)}
        </div>
      </div>
      {step===1&&<>
        <div style={{fontSize:13,color:T.text3,marginBottom:14,lineHeight:1.5}}>Регистрация только по приглашению.</div>
        <SL>Код инвайта</SL>
        <FI value={invCode} onChange={v=>{setInvCode(v);setError("");}} placeholder="FOND-XXXX" s={{fontFamily:"'DM Mono',monospace",letterSpacing:1}} />
        {error&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{error}</div>}
        <PB onClick={checkInvite} disabled={invCode.trim().length<6}>Проверить</PB>
      </>}
      {step===2&&<>
        <SL>Имя и фамилия</SL><FI value={rName} onChange={v=>{setRName(v);setError("");}} placeholder="Иван Петров" />
        <SL>Профессия</SL><FI value={rProf} onChange={setRProf} placeholder="Повар, дизайнер…" />
        <SL>Чем могу быть полезен</SL><FI value={rBio} onChange={setRBio} placeholder="Что умею…" multi />
        <SL>Telegram</SL><FI value={rTg} onChange={setRTg} placeholder="@username" s={{marginBottom:4}} />
        <PB onClick={()=>{if(!rName.trim()){setError("Введи имя");return;}setError("");setStep(3);}} s={{marginTop:10}}>Далее →</PB>
        {error&&<div style={{fontSize:12,color:"#f87171",marginTop:8}}>{error}</div>}
      </>}
      {step===3&&<>
        <SL>Логин</SL>
        <FI T={T} value={rLogin} onChange={v=>{setRLogin(v.replace(/[^a-z0-9_]/g,"").toLowerCase());setError("");}} placeholder="ivan.petrov" />
        <div style={{fontSize:11,color:T.text5,marginTop:-8,marginBottom:8}}>Только латинские буквы, цифры и _</div>
        <SL>Пароль</SL>
        <div style={{position:"relative",marginBottom:11}}>
          <input type={showP?"text":"password"} value={rPass} onChange={e=>{setRPass(e.target.value);setError("");}} placeholder="Минимум 6 символов"
            style={{width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,
              color:T.text,padding:"11px 40px 11px 14px",fontSize:14,fontFamily:"inherit",outline:"none"}} />
          <button onClick={()=>setShowP(!showP)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",color:T.text4,cursor:"pointer",fontSize:14}}>{showP?"🙈":"👁"}</button>
        </div>
        {error&&<div style={{fontSize:12,color:"#f87171",marginBottom:10}}>{error}</div>}
        <PB onClick={doRegister} disabled={!rLogin||rPass.length<6||registering}>
          {registering ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </PB>
      </>}
      <div style={{textAlign:"center",marginTop:12,fontSize:13,color:T.text4}}>
        Есть аккаунт?{" "}<span onClick={()=>{setMode("login");setError("");}} style={{color:"#6366f1",cursor:"pointer"}}>Войти</span>
      </div>
    </div>}
  </div>;
}

// ─── NETWORK GRAPH ────────────────────────────────────────────────────────────
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

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
// ─── NEG LIMIT EDITOR ────────────────────────────────────────────────────────
function NegLimitEditor({ negLimit, onSetNegLimit, T }) {
  const [val, setVal] = useState(Math.abs(negLimit));
  return <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input type="number" min="0" max="1000" value={val} onChange={e=>setVal(Number(e.target.value))}
        style={{flex:1,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,
          padding:"10px 14px",fontSize:15,fontFamily:"inherit",outline:"none"}} />
      <span style={{fontSize:13,color:T.text3,flexShrink:0}}>{CUR.plural}</span>
    </div>
    <PB T={T} onClick={()=>onSetNegLimit(-Math.abs(val))}>Сохранить</PB>
  </div>;
}


function AdminPanel({ members, offers, transactions, invites, balances, news, meId, T,
  categories, onAddCategory, onDeleteCategory, onMoveCategory, onEditCategoryIcon,
  onCreateInvite, onBack, onSelectMember, onFreezeToggle, onDeleteMember,
  onSetRole, onAddNews, onDeleteNews, negLimit, onSetNegLimit }) {

  const [atab,setAtab]=useState("members");
  const [negExpanded,setNegExpanded]=useState(false);
  const [showRoleModal,setShowRoleModal]=useState(null);
  const [showDelConfirm,setShowDelConfirm]=useState(null);
  const [newsTitle,setNewsTitle]=useState("");
  const [newsBody,setNewsBody]=useState("");
  const [newsPinned,setNewsPinned]=useState(false);
  const [newCatName,setNewCatName]=useState("");
  const [newCatIcon,setNewCatIcon]=useState("✦");
  const me=findM(members,meId);
  const isAdmin=canAdmin(me.systemRole);

  const confirmed=transactions.filter(t=>t.status==="confirmed"&&t.type==="exchange");
  const totalVol=confirmed.reduce((s,t)=>s+t.amount,0);
  const negBal=members.filter(m=>(balances[m.id]??m.balance)<-50);
  const frozen=members.filter(m=>m.frozen);
  const catVol={};
  confirmed.forEach(t=>{const o=offers.find(x=>x.id===t.offerId);const cat=o?.category||"Прочее";catVol[cat]=(catVol[cat]||0)+t.amount;});
  const maxVol=Math.max(...Object.values(catVol),1);

  const tabs=[
    {key:"members",l:"Участники"},
    {key:"analytics",l:"Реестр"},
    {key:"graph",l:"Граф"},
    {key:"invites",l:"Инвайты"},
    {key:"gifts",l:"Дары 💛"},
    ...(isAdmin?[{key:"categories",l:"Категории"},{key:"news",l:"Новости"},{key:"settings",l:"Настройки"}]:[]),
  ];

  return <div style={{animation:"fadeUp 0.25s ease"}}>
    <div style={{padding:"18px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
      <span style={{fontSize:11,background:"#fbbf2420",color:"#fbbf24",padding:"3px 10px",borderRadius:10}}>⚙ Панель управления</span>
    </div>
    <div style={{padding:"12px 20px 0"}}>
      <div style={{fontSize:19,fontWeight:700,marginBottom:12}}>Управление сообществом</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:12}}>
        {[
          {l:"Участников",v:members.length,icon:"👥"},
          {l:"Сделок",v:confirmed.length,icon:"⇄"},
          {l:`Оборот`,v:`${totalVol}${CUR.sign}`,icon:"◎"},
          {l:"В минусе",v:negBal.length,icon:"⚠",action:()=>setNegExpanded(!negExpanded),hl:negBal.length>0},
          {l:"Заморожено",v:frozen.length,icon:"❄",hl:frozen.length>0},
          {l:"Предложений",v:offers.filter(o=>o.available).length,icon:"📦"},
        ].map((k,i)=>(
          <div key={i} onClick={k.action} style={{background:T.card,border:`1px solid ${k.hl?"#f8717140":T.border}`,
            borderRadius:12,padding:"9px 11px",cursor:k.action?"pointer":"default"}}>
            <div style={{fontSize:11,color:T.text4,marginBottom:3}}>{k.icon} {k.l}</div>
            <div style={{fontSize:17,fontWeight:700,color:k.hl?"#f87171":T.text}}>{k.v}</div>
          </div>
        ))}
      </div>

      {negExpanded&&negBal.length>0&&<div style={{background:"#1a0d0d",border:"1px solid #7f1d1d",borderRadius:13,padding:"12px 14px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:600,color:"#f87171",marginBottom:8}}>⚠ Участники с низким балансом</div>
        {negBal.map(m=><div key={m.id} onClick={()=>onSelectMember(m.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",
          borderBottom:"1px solid #7f1d1d20",cursor:"pointer"}}>
          <Avatar member={m} size={30} />
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{m.name}</div></div>
          <Pill balance={balances[m.id]??m.balance} />
          <span style={{color:"#f87171",fontSize:12}}>›</span>
        </div>)}
      </div>}

      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:12,overflowX:"auto"}}>
        {tabs.map(t=><button key={t.key} onClick={()=>setAtab(t.key)} style={{
          background:"none",border:"none",padding:"10px 0",marginRight:16,fontSize:13,
          fontWeight:atab===t.key?600:400,color:atab===t.key?T.text:T.text4,
          borderBottom:atab===t.key?"2px solid #6366f1":"2px solid transparent",
          cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.l}</button>)}
      </div>

      {/* MEMBERS TAB */}
      {atab==="members"&&<div>
        {members.map(m=>{
          const bal=balances[m.id]??m.balance;
          const txC=confirmed.filter(t=>t.from===m.id||t.to===m.id).length;
          const isSelf=m.id===meId;
          return <div key={m.id} style={{background:T.card,border:`1px solid ${m.frozen?"#475569":m.id===meId?"#6366f130":T.border}`,
            borderRadius:12,padding:"11px 13px",marginBottom:8,opacity:m.frozen?0.7:1}}>
            <div style={{display:"flex",gap:11,alignItems:"center"}}>
              <div onClick={()=>onSelectMember(m.id)} style={{cursor:"pointer"}}><Avatar member={m} size={38} /></div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:13,cursor:"pointer",color:T.text}}
                    onClick={()=>onSelectMember(m.id)}>{m.name}</span>
                  <RoleBadge role={m.systemRole} />
                  {m.frozen&&<span style={{fontSize:10,background:"#47556920",color:T.text2,padding:"1px 6px",borderRadius:6}}>❄ заморожен</span>}
                </div>
                <div style={{fontSize:11,color:T.text4,marginTop:2}}>{m.profession} · {txC} сделок</div>
              </div>
              <Pill balance={bal} />
            </div>
            {!isSelf&&<div style={{display:"flex",gap:6,marginTop:10,paddingTop:9,borderTop:"1px solid #1e2330"}}>
              {isAdmin&&<button onClick={()=>setShowRoleModal(m.id)} style={{flex:1,background:T.bg,
                border:`1px solid ${T.border}`,color:"#818cf8",padding:"6px",borderRadius:8,
                fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⚙ Роль</button>}
              <button onClick={()=>onFreezeToggle(m.id)} style={{flex:1,background:T.bg,
                border:`1px solid ${T.border}`,color:m.frozen?"#4ade80":"#fbbf24",padding:"6px",borderRadius:8,
                fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{m.frozen?"❄ Разморозить":"❄ Заморозить"}</button>
              {isAdmin&&<button onClick={()=>setShowDelConfirm(m.id)} style={{background:T.bg,
                border:"1px solid #7f1d1d",color:"#f87171",padding:"6px 10px",borderRadius:8,
                fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
            </div>}
          </div>;
        })}
      </div>}

      {/* ANALYTICS TAB */}
      {atab==="analytics"&&<div>
        {Object.keys(catVol).length>0&&<div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"13px 14px",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Оборот по категориям</div>
          {Object.entries(catVol).sort((a,b)=>b[1]-a[1]).map(([cat,vol])=>(
            <div key={cat} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.text2,marginBottom:3}}>
                <span>{CAT_ICONS[cat]||"◎"} {cat}</span><span style={{fontWeight:600}}>{cur(vol)}</span>
              </div>
              <div style={{height:5,background:T.border,borderRadius:3}}>
                <div style={{height:"100%",borderRadius:3,background:"#6366f1",width:`${(vol/maxVol)*100}%`}} /></div>
            </div>
          ))}
        </div>}
        <div style={{fontSize:11,color:T.text4,marginBottom:8}}>Все транзакции · {transactions.length}</div>
        {transactions.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>Транзакций пока нет</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {transactions.map(tx=>{
            const from=findM(members,tx.from),to=findM(members,tx.to);
            const sc=S_COLOR[tx.status]||"#475569";
            return <div key={tx.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}>
                    <span>{tx.type==="gift"?"💛":"⇄"}</span>
                    <span style={{fontSize:13,fontWeight:500}}>{tx.what}</span>
                  </div>
                  <div style={{fontSize:11,color:T.text3,display:"flex",gap:5,alignItems:"center"}}>
                    <span style={{cursor:"pointer",color:"#6366f1"}} onClick={()=>from.id&&onSelectMember(from.id)}>{from.name.split(" ")[0]}</span>
                    <span>→</span>
                    <span style={{cursor:"pointer",color:"#6366f1"}} onClick={()=>to.id&&onSelectMember(to.id)}>{to.name.split(" ")[0]}</span>
                    <span style={{background:`${sc}20`,color:sc,padding:"1px 5px",borderRadius:5,fontSize:10}}>{S_LABEL[tx.status]||tx.status}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700}}>{cur(tx.amount)}</div>
                  <div style={{fontSize:10,color:T.text5,fontFamily:"monospace"}}>{tx.date}</div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* GRAPH TAB */}
      {atab==="graph"&&<div>
        <NetworkGraph members={members} transactions={transactions} invites={invites} onSelectMember={onSelectMember} />
        <div style={{marginTop:14}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Топ участников</div>
          {[...members].sort((a,b)=>confirmed.filter(t=>t.from===b.id||t.to===b.id).length-confirmed.filter(t=>t.from===a.id||t.to===a.id).length).slice(0,5).map((m,i)=>{
            const sc=confirmed.filter(t=>t.from===m.id||t.to===m.id).length;
            const inv=members.filter(x=>x.invitedBy===m.id).length;
            return <div key={m.id} onClick={()=>onSelectMember(m.id)} style={{display:"flex",alignItems:"center",gap:10,
              background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 12px",marginBottom:6,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.border}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              <span style={{fontSize:13,color:T.text5,fontWeight:700,width:16}}>#{i+1}</span>
              <Avatar member={m} size={32} />
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:11,color:T.text4}}>{sc} сделок · привёл {inv}</div></div>
              <Pill balance={balances[m.id]??m.balance} />
            </div>;
          })}
        </div>
      </div>}

      {/* INVITES TAB */}
      {atab==="invites"&&<div>
        <PB v="green" onClick={onCreateInvite} s={{marginBottom:12}}>+ Создать инвайт</PB>
        {invites.map(inv=>{
          const creator=inv.createdBy>0?findM(members,inv.createdBy):{name:"Admin",avatar:"⚙",id:0};
          const user=inv.usedBy?findM(members,inv.usedBy):null;
          return <div key={inv.code} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:7,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:user?"#475569":"#e2e8f0"}}>{inv.code}</div>
              <div style={{fontSize:11,color:T.text5,marginTop:2}}>Создал: <span style={{color:T.text2}}>{creator.name}</span> · {inv.createdAt}</div>
              {user?<div style={{fontSize:11,color:"#4ade80",marginTop:2}}>Использовал: {user.name}</div>
                :<div style={{fontSize:11,color:"#fbbf24",marginTop:2}}>Ожидает</div>}
            </div>
            {!user&&<CopyBtn text={inv.code} T={T} />}
          </div>;
        })}
      </div>}

      {/* GIFTS TAB */}
      {atab==="gifts"&&<div>
        <div style={{fontSize:11,color:T.text4,marginBottom:10}}>
          Все дары · {transactions.filter(t=>t.type==="gift").length} записей
        </div>
        {transactions.filter(t=>t.type==="gift").length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>Даров пока не было</div>}
        {[...transactions].filter(t=>t.type==="gift").reverse().map(tx=>{
          const from=findM(members,tx.from),to=findM(members,tx.to);
          return <div key={tx.id} style={{background:T.card,border:"1px solid #22c55e30",borderRadius:10,padding:"10px 14px",marginBottom:7}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span>💛</span><span style={{fontWeight:600,fontSize:13}}>{tx.what}</span>
                </div>
                <div style={{fontSize:12,color:T.text3,display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{cursor:from.id?"pointer":"default",color:from.id?"#6366f1":"#475569"}}
                    onClick={()=>from.id&&onSelectMember(from.id)}>{from.name}</span>
                  <span>→</span>
                  <span style={{cursor:to.id?"pointer":"default",color:to.id?"#6366f1":"#475569"}}
                    onClick={()=>to.id&&onSelectMember(to.id)}>{to.name}</span>
                </div>
                {tx.note&&<div style={{fontSize:11,color:T.text4,marginTop:4,fontStyle:"italic"}}>«{tx.note}»</div>}
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <div style={{fontSize:14,fontWeight:700,color:"#fbbf24"}}>{cur(tx.amount)}</div>
                <div style={{fontSize:10,color:T.text5,fontFamily:"monospace",marginTop:2}}>{tx.date}</div>
              </div>
            </div>
          </div>;
        })}
      </div>}

      {/* NEWS TAB */}
      {/* CATEGORIES TAB */}
      {atab==="categories"&&isAdmin&&<div>
        <div style={{fontSize:12,color:T.text4,marginBottom:12}}>Управление категориями · {(categories||[]).filter(c=>c!=="Все").length} категорий</div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:14,marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:10}}>Добавить категорию</div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={newCatIcon} onChange={e=>setNewCatIcon(e.target.value)} placeholder="🏷"
              style={{width:46,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"10px",fontSize:18,fontFamily:"inherit",outline:"none",textAlign:"center"}} />
            <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Название категории"
              style={{flex:1,background:T.input,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
          <PB T={T} disabled={!newCatName.trim()||(categories||[]).includes(newCatName.trim())}
            onClick={()=>{
              if(onAddCategory)onAddCategory(newCatName.trim(),newCatIcon);
              setNewCatName("");setNewCatIcon("✦");
            }}>+ Добавить</PB>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(categories||[]).filter(c=>c!=="Все").map((cat,idx,arr)=>{
            const cnt=offers.filter(o=>o.category===cat).length;
            return <div key={cat} style={{display:"flex",alignItems:"center",gap:8,
              background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                <button onClick={()=>onMoveCategory&&onMoveCategory(cat,-1)} disabled={idx===0}
                  style={{background:"none",border:`1px solid ${T.border}`,color:idx===0?T.text5:T.text3,
                    width:22,height:22,borderRadius:5,fontSize:10,cursor:idx===0?"default":"pointer",
                    fontFamily:"inherit",lineHeight:1,opacity:idx===0?0.3:1}}>▲</button>
                <button onClick={()=>onMoveCategory&&onMoveCategory(cat,1)} disabled={idx===arr.length-1}
                  style={{background:"none",border:`1px solid ${T.border}`,color:idx===arr.length-1?T.text5:T.text3,
                    width:22,height:22,borderRadius:5,fontSize:10,cursor:idx===arr.length-1?"default":"pointer",
                    fontFamily:"inherit",lineHeight:1,opacity:idx===arr.length-1?0.3:1}}>▼</button>
              </div>
              <div style={{width:34,height:34,borderRadius:9,background:T.border,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
                {CAT_ICONS[cat]||"✦"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,color:T.text}}>{cat}</div>
                <div style={{fontSize:11,color:T.text4}}>{cnt} предложений</div>
              </div>
              <input defaultValue={CAT_ICONS[cat]||"✦"}
                onBlur={e=>{ const v=e.target.value.trim(); if(v&&onEditCategoryIcon) onEditCategoryIcon(cat,v); }}
                style={{width:36,textAlign:"center",fontSize:18,background:T.input,
                  border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"4px",
                  fontFamily:"inherit",outline:"none",flexShrink:0}} title="Иконка" />
              {cnt===0&&<button onClick={()=>onDeleteCategory&&onDeleteCategory(cat)}
                style={{background:"none",border:`1px solid ${T.border}`,color:"#f87171",
                  padding:"4px 9px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
              {cnt>0&&<span style={{fontSize:10,color:T.text5,padding:"2px 6px",background:T.border,borderRadius:5}}>исп.</span>}
            </div>;
          })}
        </div>
      </div>}

      {atab==="news"&&isAdmin&&<div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>Новая новость</div>
          <SL T={T}>Заголовок</SL><FI T={T} value={newsTitle} onChange={setNewsTitle} placeholder="Заголовок" />
          <SL T={T}>Текст</SL><FI T={T} value={newsBody} onChange={setNewsBody} placeholder="Текст новости…" multi />
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}>
            <div onClick={()=>setNewsPinned(!newsPinned)} style={{width:36,height:20,borderRadius:10,background:newsPinned?"#6366f1":T.border,
              cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
              <div style={{position:"absolute",top:2,left:newsPinned?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}} /></div>
            <span style={{fontSize:13,color:T.text3}}>Закрепить</span>
          </div>
          <PB onClick={()=>{if(newsTitle.trim()&&newsBody.trim()){onAddNews({title:newsTitle,body:newsBody,pinned:newsPinned});setNewsTitle("");setNewsBody("");setNewsPinned(false);}}}
            disabled={!newsTitle.trim()||!newsBody.trim()}>Опубликовать</PB>
        </div>
        {[...news].sort((a,b)=>b.pinned-a.pinned).map(n=>(
          <div key={n.id} style={{background:T.card,border:`1px solid ${n.pinned?"#6366f140":T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                {n.pinned&&<span style={{fontSize:10,color:"#6366f1",marginBottom:4,display:"block"}}>📌 Закреплено</span>}
                <div style={{fontWeight:600,fontSize:14,marginBottom:5}}>{n.title}</div>
                <div style={{fontSize:13,color:T.text3,lineHeight:1.5}}>{n.body}</div>
                <div style={{fontSize:11,color:T.text5,marginTop:6,fontFamily:"monospace"}}>{n.date}</div>
              </div>
              <button onClick={()=>onDeleteNews(n.id)} style={{background:"none",border:"none",color:T.text5,fontSize:16,cursor:"pointer",marginLeft:10,flexShrink:0}}>✕</button>
            </div>
          </div>
        ))}
      </div>}
    </div>

    {/* ROLE MODAL */}
    {showRoleModal&&<Sheet onClose={()=>setShowRoleModal(null)}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:14}}>Роль участника</div>
      <div style={{fontSize:13,color:T.text3,marginBottom:16}}>{findM(members,showRoleModal).name}</div>
      {[ROLES.member,ROLES.moderator,ROLES.admin].map(r=>(
        <div key={r} onClick={()=>{onSetRole(showRoleModal,r);setShowRoleModal(null);}} style={{
          display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",marginBottom:8,
          background:findM(members,showRoleModal).systemRole===r?"#6366f115":T.bg,
          border:`1px solid ${findM(members,showRoleModal).systemRole===r?"#6366f140":T.border}`}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:ROLE_COLOR[r]}} />
          <div><div style={{fontWeight:600,fontSize:14}}>{ROLE_LABEL[r]}</div>
            <div style={{fontSize:11,color:T.text3}}>
              {r===ROLES.admin?"Полные права"
                :r===ROLES.moderator?"Управление участниками и предложениями"
                :"Стандартный участник"}
            </div>
          </div>
          {findM(members,showRoleModal).systemRole===r&&<span style={{marginLeft:"auto",color:"#6366f1"}}>✓</span>}
        </div>
      ))}
    </Sheet>}

    {/* DELETE CONFIRM */}
    {showDelConfirm&&<Sheet onClose={()=>setShowDelConfirm(null)}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>Удалить участника?</div>
      <div style={{fontSize:13,color:T.text3,marginBottom:8}}>
        <b style={{color:T.text}}>{findM(members,showDelConfirm).name}</b>
      </div>
      <div style={{fontSize:13,color:T.text3,lineHeight:1.5,marginBottom:20,background:T.bg,padding:"10px 12px",borderRadius:10}}>
        Профиль будет деактивирован. История транзакций сохранится — балансы других участников не изменятся.
        {(balances[showDelConfirm]??0)>0&&<span style={{color:"#fbbf24",display:"block",marginTop:6}}>Положительный баланс ({cur(balances[showDelConfirm])}) перейдёт в общий фонд.</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <PB v="danger" onClick={()=>{onDeleteMember(showDelConfirm);setShowDelConfirm(null);}}>Удалить</PB>
        <PB v="ghost" onClick={()=>setShowDelConfirm(null)} s={{flex:"0 0 90px"}}>Отмена</PB>
      </div>
    </Sheet>}

      {atab==="settings"&&isAdmin&&<div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>⚖️ Лимит задолженности</div>
          <div style={{fontSize:12,color:T.text3,marginBottom:12,lineHeight:1.5}}>
            Участник не может уйти ниже этого значения. Текущий лимит: <b style={{color:"#f87171"}}>-{cur(Math.abs(negLimit))}</b>
          </div>
          <NegLimitEditor negLimit={negLimit} onSetNegLimit={onSetNegLimit} T={T} />
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px"}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:10}}>📊 Статистика фонда</div>
          {[
            {l:"Участников активных",v:members.filter(m=>!m.frozen).length},
            {l:"Предложений в каталоге",v:offers.filter(o=>o.available&&(o.qty-o.reserved)>0).length},
            {l:"Сделок завершено",v:transactions.filter(t=>t.status==="confirmed").length},
            {l:"Зёрен в обороте",v:parseFloat(Object.values(balances).filter(b=>b>0).reduce((a,b)=>a+b,0).toFixed(1))},
            {l:"Суммарная задолженность",v:parseFloat(Object.values(balances).filter(b=>b<0).reduce((a,b)=>a+b,0).toFixed(1))},
          ].map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:13,color:T.text3}}>{s.l}</span>
            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{s.v}</span>
          </div>)}
        </div>
      </div>}

  </div>;
}

// ─── OFFER / REQUEST FORMS ────────────────────────────────────────────────────
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

// ─── REQUEST DETAIL ───────────────────────────────────────────────────────────
function RequestDetail({ request, members, meId, onAcceptBid, onDeclineBid, onBid, onClose, T }) {
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

// ─── PROFILE ──────────────────────────────────────────────────────────────────
// ─── DEMURRAGE INFO WIDGET ───────────────────────────────────────────────────
function DemurrageInfo({ memberId, balances, transactions, T }) {
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
  return <div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"11px 14px",marginTop:8}}>
    <div style={{fontSize:12,fontWeight:600,color:"#fb923c",marginBottom:7}}>📉 Демередж</div>
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {currentDemurrage>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Уже начислено</span>
        <span style={{color:"#f87171",fontWeight:600}}>-{cur(currentDemurrage)}</span>
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Облагаемая сумма</span>
        <span style={{color:T.text2}}>{cur(taxable)}</span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Ставка в месяц</span>
        <span style={{color:"#fb923c"}}>{(DEMURRAGE_RATE*100).toFixed(0)}% → -{cur(perMonth)}</span>
      </div>
      {daysSince>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Дней без активности</span>
        <span style={{color:T.text2}}>{daysSince}</span>
      </div>}
      <div style={{borderTop:`1px solid ${T.border}`,marginTop:4,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:12}}>
        <span style={{color:T.text3}}>Эффективный баланс</span>
        <span style={{color:"#4ade80",fontWeight:700}}>{cur(effective)}</span>
      </div>
    </div>
    <div style={{fontSize:11,color:T.text5,marginTop:6,lineHeight:1.4}}>💡 Совершите сделку чтобы обнулить таймер</div>
  </div>;
}


function ProfileScreen({ member, members, offers, transactions, balances, invites, meId, T,
  reviews, onReview, categories,
  onBack, onAddOffer, onEditOffer, onToggleOffer, onDeleteOffer,
  onUpdateProfile, onCreateInvite, onCancelTx, onConfirmTx, onSelectMember }) {

  const [ptab,A]=useState("fund");
  const [addOff,B]=useState(false); const [editOff,C]=useState(null); const [editMode,D]=useState(false);
  const [eName,E]=useState(member.name); const [ePro,F]=useState(member.profession||"");
  const [eBio,G]=useState(member.bio||""); const [eHelp,H]=useState(member.helpful||"");
  const [eTg,I]=useState(member.telegram||""); const [eIg,J]=useState(member.instagram||"");
  const photoRef=useRef();

  // swipe right = back
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

  return <div style={{animation:"fadeUp 0.25s ease"}} {...swipe}>
    <div style={{padding:"18px 20px 0"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
    </div>
    <div style={{padding:"14px 20px 0"}}>
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{position:"relative",flexShrink:0}}>
          <Avatar member={member} size={70} />
          {isMe&&<><button onClick={()=>photoRef.current.click()} style={{position:"absolute",bottom:-2,right:-2,width:23,height:23,borderRadius:"50%",background:"#6366f1",border:"2px solid #0d0f14",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
          <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}} /></>}
        </div>
        <div style={{flex:1}}>
          {editMode?<FI T={T} value={eName} onChange={E} placeholder="Имя" s={{marginBottom:7}} />
            :<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{fontSize:19,fontWeight:700}}>{member.name}</span>
              {isMe&&<span style={{fontSize:11,background:"#6366f120",color:"#818cf8",padding:"2px 7px",borderRadius:10}}>вы</span>}
              <RoleBadge role={member.systemRole} />
            </div>}
          {editMode?<FI T={T} value={ePro} onChange={F} placeholder="Профессия" s={{marginBottom:0}} />
            :<div style={{fontSize:13,color:T.text3,marginBottom:4}}>{member.profession||"—"}</div>}
          {!editMode&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {member.telegram&&<a href={`https://t.me/${member.telegram.replace("@","")}`} target="_blank" rel="noreferrer"
              style={{fontSize:12,color:"#38bdf8",textDecoration:"none"}}>✈ {member.telegram}</a>}
            {member.instagram&&<a href={`https://instagram.com/${member.instagram.replace("@","")}`} target="_blank" rel="noreferrer"
              style={{fontSize:12,color:"#f472b6",textDecoration:"none"}}>◎ {member.instagram}</a>}
          </div>}
          {member.frozen&&<div style={{fontSize:12,color:T.text2,marginTop:4}}>❄ Аккаунт заморожен</div>}
        </div>
        {isMe&&!editMode&&<button onClick={()=>D(true)} style={{background:T.border,border:"none",color:"#6366f1",padding:"5px 11px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Изменить</button>}
      </div>

      {editMode&&<div style={{marginTop:12}}>
        <SL>Биография</SL><FI T={T} value={eBio} onChange={G} placeholder="О себе…" multi />
        <SL>Чем полезен</SL><FI T={T} value={eHelp} onChange={H} placeholder="Конкретная помощь…" multi />
        <div style={{display:"flex",gap:8,marginBottom:11}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"#38bdf8",marginBottom:4,fontWeight:500}}>✈ Telegram</div>
            <input value={eTg} onChange={e=>I(e.target.value)} placeholder="@username" style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:"#38bdf8",padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"#f472b6",marginBottom:4,fontWeight:500}}>◎ Instagram</div>
            <input value={eIg} onChange={e=>J(e.target.value)} placeholder="@username" style={{width:"100%",background:T.input,border:`1px solid ${T.border}`,borderRadius:10,color:"#f472b6",padding:"10px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
          </div>
        </div>
        <div style={{display:"flex",gap:8}}><PB onClick={saveProfile}>Сохранить</PB><PB v="ghost" onClick={()=>D(false)} s={{flex:"0 0 76px"}}>Отмена</PB></div>
      </div>}

      {!editMode&&<>
        {member.bio&&<div style={{fontSize:13,color:T.text2,lineHeight:1.5,marginTop:10}}>{member.bio}</div>}
        {member.helpful&&<div style={{fontSize:13,color:T.text3,lineHeight:1.5,background:T.card,borderRadius:10,padding:"9px 12px",marginTop:8,borderLeft:"3px solid #6366f1"}}>
          <span style={{color:"#6366f1",fontWeight:600}}>Полезен: </span>{member.helpful}</div>}

        {/* CLICKABLE invite links */}
        {(invBy||invitedPeople.length>0)&&<div style={{marginTop:10,fontSize:12,background:T.card,borderRadius:10,padding:"9px 12px"}}>
          {invBy&&<div style={{marginBottom:invitedPeople.length>0?5:0}}>
            <span style={{color:T.text4}}>Пришёл по приглашению: </span>
            <span onClick={()=>onSelectMember(invBy.id)} style={{color:"#6366f1",cursor:"pointer",fontWeight:500}}>{invBy.name}</span>
          </div>}
          {invitedPeople.length>0&&<div>
            <span style={{color:T.text4}}>Привёл: </span>
            {invitedPeople.map((m,i)=><span key={m.id}>
              <span onClick={()=>onSelectMember(m.id)} style={{color:"#6366f1",cursor:"pointer",fontWeight:500}}>{m.name.split(" ")[0]}</span>
              {i<invitedPeople.length-1&&<span style={{color:T.text5}}>, </span>}
            </span>)}
          </div>}
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px",gridColumn:"span 3"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:T.text4,marginBottom:5}}>Баланс</div><Pill balance={bal} /></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:T.text4,marginBottom:3}}>Кошелёк</div>
                <div style={{fontFamily:"monospace",fontSize:11,color:"#6366f1"}}>{walletNum(member.id,member.joined)}</div>
                <div style={{fontSize:10,color:T.text5,marginTop:2}}>потенциал: {cur(payPotential(member.id,offers,bal))}</div>
              </div>
            </div>
            {isMe&&<DemurrageInfo memberId={member.id} balances={balances} transactions={transactions} T={T} />}
          </div>
          {[{l:"Заработано",v:`+${cur(earned)}`,c:"#4ade80"},{l:"Потрачено",v:`-${cur(spent)}`,c:"#f87171"},{l:"Даров",v:`${giftsIn} 💛`,c:"#fbbf24"}]
            .map((s,i)=><div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 10px"}}>
              <div style={{fontSize:11,color:T.text4,marginBottom:3}}>{s.l}</div>
              <div style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div>
            </div>)}
        </div>

        <div style={{display:"flex",marginTop:12,borderBottom:"1px solid #1e2330"}}>
          {TABS.map(t=><button key={t.key} onClick={()=>A(t.key)} style={{
            background:"none",border:"none",padding:"11px 0",marginRight:16,fontSize:13,
            fontWeight:ptab===t.key?600:400,color:ptab===t.key?T.text:T.text4,
            borderBottom:ptab===t.key?"2px solid #6366f1":"2px solid transparent",
            cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>)}
        </div>
      </>}
    </div>

    {!editMode&&ptab==="fund"&&<div style={{padding:"12px 20px"}}>
      {isMe&&<button onClick={()=>B(true)} style={{width:"100%",background:T.card,border:"1px dashed #2d3548",borderRadius:14,padding:"11px",color:"#6366f1",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:11}}>+ Добавить предложение</button>}
      {myOff.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>{isMe?"Вы пока ничего не добавили":"Нет предложений"}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {myOff.map(o=>{const av=o.qty-o.reserved;return <div key={o.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"13px 14px",opacity:o.available?1:0.5}}>
          <div style={{display:"flex",gap:11}}>
            <div style={{width:38,height:38,borderRadius:10,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{CAT_ICONS[o.category]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{o.title}</div>
              <div style={{fontSize:12,color:T.text3,marginTop:3}}>{o.desc}</div>
              <div style={{marginTop:6,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,fontWeight:600,color:o.price===0?"#4ade80":T.text}}>{o.price===0?"бесплатно":`${cur(o.price)}/${o.unit}`}</span>
                <span style={{fontSize:11,color:o.available?"#4ade80":T.text4}}>{o.available?"● доступно":"○ пауза"}</span>
              </div>
              <QtyBar qty={o.qty} reserved={o.reserved} />
            </div>
          </div>
          {isMe&&<div style={{display:"flex",gap:7,marginTop:10,paddingTop:10,borderTop:"1px solid #1e2330"}}>
            <button onClick={()=>C(o)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.text2,padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✏</button>
            <button onClick={()=>onToggleOffer(o.id)} style={{flex:1.5,background:T.bg,border:`1px solid ${T.border}`,color:o.available?"#fbbf24":"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{o.available?"⏸ Пауза":"▶ Активировать"}</button>
            <button onClick={()=>av===o.qty&&onDeleteOffer(o.id)} style={{background:T.bg,border:`1px solid ${T.border}`,color:av<o.qty?"#334155":"#f87171",padding:"7px 12px",borderRadius:8,fontSize:13,cursor:av===o.qty?"pointer":"not-allowed",fontFamily:"inherit"}}>✕</button>
          </div>}
        </div>;})}
      </div>
    </div>}

    {!editMode&&ptab==="history"&&<div style={{padding:"12px 20px"}}>
      {myTx.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0"}}>Нет сделок</div>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {myTx.map(tx=>{
          const isOut=tx.from===member.id,other=isOut?findM(members,tx.to):findM(members,tx.from);
          const isGift=tx.type==="gift",sc=S_COLOR[tx.status]||"#475569";
          const iAmBuyer=tx.from===meId;
          const iAmSeller=tx.to===meId;
          const canConfirm=!tx.reqId&&tx.status==="active"&&iAmBuyer&&member.id===meId;
          const canConfirmReq=tx.reqId&&tx.status==="awaiting_confirm"&&iAmBuyer&&member.id===meId;
          const canMarkDone=tx.reqId&&tx.status==="active"&&iAmSeller&&member.id===meId;
          const canCancel=tx.status==="active"&&!tx.reqId&&(iAmBuyer||iAmSeller);
          return <div key={tx.id} style={{background:T.card,border:`1px solid ${tx.status==="cancelled"?"#334155":T.border}`,borderRadius:12,padding:"11px 13px",opacity:tx.status==="cancelled"?0.4:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                  <span>{isGift?"💛":tx.status==="cancelled"?"✕":isOut?"↑":"↓"}</span>
                  <span style={{fontWeight:500,fontSize:13}}>{tx.what}</span>
                  {tx.qty>1&&<span style={{fontSize:11,color:T.text3}}>×{tx.qty}</span>}
                </div>
                <div style={{fontSize:11,color:T.text4,display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                  <span style={{color:isOut?"#f87171":"#4ade80"}}>{isOut?"вы →":"← вам"}</span>
                  <Avatar member={other} size={14} />
                  <span>{other.name?.split(" ")[0]}</span>
                </div>
                <span style={{fontSize:11,background:`${sc}15`,color:sc,padding:"2px 7px",borderRadius:5}}>{S_LABEL[tx.status]||tx.status}</span>
              </div>
              <div style={{textAlign:"right",marginLeft:10}}>
                <div style={{fontWeight:700,fontSize:14,color:tx.status==="cancelled"?T.text5:isGift?"#fbbf24":isOut?"#f87171":"#4ade80"}}>{isOut?"-":"+"}{cur(tx.amount)}</div>
                <div style={{fontSize:10,color:T.text5,marginTop:2,fontFamily:"monospace"}}>{tx.date}</div>
              </div>
            </div>
            {(canConfirm||canConfirmReq||canMarkDone||canCancel||tx.status==="awaiting_confirm")&&<div style={{display:"flex",gap:7,marginTop:9,flexWrap:"wrap"}}>
              {canConfirm&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Подтвердить получение</button>}
              {canConfirmReq&&<button onClick={()=>onConfirmTx(tx.id)} style={{flex:1,background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Принять работу</button>}
              {canMarkDone&&<button onClick={()=>onMarkDone&&onMarkDone(tx.id)} style={{flex:1,background:"#1e3a5f",border:"1px solid #1d4ed8",color:"#60a5fa",padding:"7px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✓ Выполнено</button>}
              {tx.status==="awaiting_confirm"&&iAmSeller&&<div style={{fontSize:11,color:"#4ade80",padding:"6px 10px",background:"#4ade8010",borderRadius:8,flex:1,textAlign:"center"}}>✓ Ждём подтверждения заказчика</div>}
              {tx.status==="active"&&tx.reqId&&iAmBuyer&&<div style={{fontSize:11,color:"#818cf8",padding:"6px 10px",background:"#6366f110",borderRadius:8,flex:1,textAlign:"center"}}>⏳ Ждём выполнения</div>}
              {canCancel&&<button onClick={()=>onCancelTx(tx.id)} style={{background:T.input,border:"1px solid #7f1d1d",color:"#f87171",padding:"7px 10px",borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Отменить</button>}
            </div>}
            {tx.status==="confirmed"&&(tx.from===meId||tx.to===meId)&&onReview&&(
              (reviews||[]).find(r=>r.txId===tx.id&&r.from===meId)
                ? <div style={{marginTop:8,fontSize:11,color:"#4ade80",padding:"6px 10px",background:"#4ade8010",borderRadius:8,textAlign:"center"}}>⭐ Отзыв оставлен</div>
                : <button onClick={()=>onReview(tx)} style={{marginTop:8,width:"100%",background:T.input,border:`1px solid ${T.border}`,color:T.text3,padding:"6px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                    ⭐ Оставить отзыв
                  </button>
            )}
          </div>;
        })}
      </div>
    </div>}

    {!editMode&&ptab==="reviews"&&<div style={{padding:"12px 20px"}}>
      <ReviewsList reviews={memberReviews} members={members} T={T} />
    </div>}

    {!editMode&&ptab==="invites"&&isMe&&<div style={{padding:"12px 20px"}}>
      <PB v="green" onClick={onCreateInvite} s={{marginBottom:12}}>+ Создать инвайт</PB>
      {myInvites.map(inv=>{const used=inv.usedBy?findM(members,inv.usedBy):null;
        return <div key={inv.code} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"monospace",fontSize:14,fontWeight:600,color:used?T.text4:T.text}}>{inv.code}</div>
            {used?<div style={{fontSize:11,color:"#4ade80",marginTop:2}}>Использовал: <span onClick={()=>onSelectMember(used.id)} style={{cursor:"pointer",textDecoration:"underline"}}>{used.name}</span></div>
              :<div style={{fontSize:11,color:"#fbbf24",marginTop:2}}>Ожидает</div>}
          </div>
          {!used&&<CopyBtn text={inv.code} T={T} />}
        </div>;})}
    </div>}

    {addOff&&<OfferForm T={T} categories={categories} onClose={()=>B(false)} onSave={d=>{onAddOffer(d);B(false);}} />}
    {editOff&&<OfferForm T={T} categories={categories} initial={editOff} onClose={()=>C(null)} onSave={d=>{onEditOffer(editOff.id,d);C(null);}} />}
  </div>;
}

// ─── MY TASKS SCREEN ─────────────────────────────────────────────────────────
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


// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────
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

// ─── CHAT SCREEN ─────────────────────────────────────────────────────────────
// ─── CHAT SCREEN ─────────────────────────────────────────────────────────────
function ChatScreen({ meId, members, messages, groupMessages, onSend, onBack, T, onSelectMember }) {
  const [view, setView] = useState("list"); // "list" | "thread" | "group"
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState("");
  const endRef = useRef();
  const swipe = useSwipe(()=>{
    if(view==="thread"||view==="group") setView("list");
    else onBack();
  });

  const convs = members.filter(m=>m.id!==meId).map(m=>{
    const thread = messages.filter(msg=>(msg.from===meId&&msg.to===m.id)||(msg.from===m.id&&msg.to===meId));
    const last = thread[thread.length-1];
    const unread = thread.filter(msg=>msg.to===meId&&!msg.read).length;
    return {member:m, thread, last, unread};
  }).filter(c=>c.thread.length>0 || c.member.id===peer?.id)
    .sort((a,b)=>(b.last?.ts||0)-(a.last?.ts||0));

  function openThread(m) { setPeer(m); setView("thread"); onSend(null,m.id,null); }

  function sendMsg() {
    if(!text.trim()) return;
    if(view==="group") { onSend(meId,"group",text.trim()); }
    else if(peer) { onSend(meId,peer.id,text.trim()); }
    setText("");
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);
  }

  const peerThread = peer ? messages.filter(msg=>(msg.from===meId&&msg.to===peer.id)||(msg.from===peer.id&&msg.to===meId)) : [];
  const groupUnread = 0; // group messages always visible

  const inputBar = (placeholder) => (
    <div style={{padding:"10px 16px 16px",borderTop:`1px solid ${T.border}`,background:T.bg,display:"flex",gap:8}}>
      <input value={text} onChange={e=>setText(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(sendMsg(),e.preventDefault())}
        placeholder={placeholder} style={{flex:1,background:T.card,border:`1px solid ${T.border}`,
          borderRadius:20,color:T.text,padding:"10px 14px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
      <button onClick={sendMsg} style={{background:"#6366f1",border:"none",borderRadius:"50%",width:38,height:38,
        color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>↑</button>
    </div>
  );

  // ── GROUP CHAT VIEW ──
  if(view==="group") return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:T.bg,color:T.text}} {...swipe}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,
        background:T.bg,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:T.text4,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0}}>← назад</button>
        <div style={{width:36,height:36,borderRadius:"50%",background:"#6366f120",border:"1px solid #6366f140",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🌾</div>
        <div>
          <div style={{fontWeight:600,fontSize:14,color:T.text}}>Общий форум</div>
          <div style={{fontSize:11,color:T.text4}}>{members.length} участников</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {groupMessages.length===0&&<div style={{textAlign:"center",color:T.text5,marginTop:40,fontSize:13}}>
          Напиши первым! 👋
        </div>}
        {groupMessages.map((msg,i)=>{
          const isMe=msg.from===meId;
          const sender=members.find(m=>m.id===msg.from);
          return <div key={i} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
            {!isMe&&<div onClick={()=>onSelectMember&&onSelectMember(msg.from)} style={{fontSize:10,color:T.accent,marginBottom:2,marginLeft:8,cursor:"pointer"}}>{sender?.name?.split(" ")[0]||"?"}</div>}
            <div style={{maxWidth:"78%",background:isMe?"#6366f1":T.card,
              border:isMe?"none":`1px solid ${T.border}`,
              borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
              padding:"9px 13px",color:isMe?"#fff":T.text}}>
              <div style={{fontSize:14,lineHeight:1.4}}>{msg.text}</div>
              <div style={{fontSize:10,color:isMe?"rgba(255,255,255,0.6)":T.text5,marginTop:3,textAlign:"right"}}>{msg.time}</div>
            </div>
          </div>;
        })}
        <div ref={endRef} />
      </div>
      {inputBar("Написать в форум…")}
    </div>
  );

  // ── THREAD VIEW ──
  if(view==="thread"&&peer) return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:T.bg,color:T.text}} {...swipe}>
      <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,
        background:T.bg,position:"sticky",top:0,zIndex:10}}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:T.text4,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0}}>← назад</button>
        <Avatar member={peer} size={34} />
        <div>
          <div onClick={()=>onSelectMember&&onSelectMember(peer.id)} style={{fontWeight:600,fontSize:14,color:T.accent,cursor:"pointer"}}>{peer.name} →</div>
          <div style={{fontSize:11,color:T.text4}}>{peer.profession||"участник"}</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {peerThread.length===0&&<div style={{textAlign:"center",color:T.text5,marginTop:40,fontSize:13}}>Начни переписку 👋</div>}
        {peerThread.map((msg,i)=>{
          const isMe=msg.from===meId;
          return <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"75%",background:isMe?"#6366f1":T.card,
              border:isMe?"none":`1px solid ${T.border}`,
              borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
              padding:"9px 13px",color:isMe?"#fff":T.text}}>
              <div style={{fontSize:14,lineHeight:1.4}}>{msg.text}</div>
              <div style={{fontSize:10,color:isMe?"rgba(255,255,255,0.6)":T.text5,marginTop:3,textAlign:"right"}}>{msg.time}</div>
            </div>
          </div>;
        })}
        <div ref={endRef} />
      </div>
      {inputBar(`Написать ${peer.name.split(" ")[0]}…`)}
    </div>
  );

  // ── LIST VIEW ──
  return (
    <div style={{animation:"fadeUp 0.25s ease",minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}} {...swipe}>
      <div style={{padding:"18px 20px 0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
        <div style={{fontSize:19,fontWeight:700}}>Сообщения</div>
      </div>
      <div style={{padding:"12px 20px"}}>
        {/* GROUP CHAT BUTTON */}
        <div onClick={()=>setView("group")} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
          background:"#6366f115",border:"1px solid #6366f130",borderRadius:14,marginBottom:14,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="#6366f120"}
          onMouseLeave={e=>e.currentTarget.style.background="#6366f115"}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"#6366f120",border:"1px solid #6366f140",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🌾</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:"#818cf8"}}>Общий форум</div>
            <div style={{fontSize:12,color:T.text4,marginTop:1}}>
              {groupMessages.length>0
                ? groupMessages[groupMessages.length-1].text.slice(0,40)+"…"
                : `${members.length} участников · Общий чат`}
            </div>
          </div>
          {groupMessages.length>0&&<div style={{fontSize:11,color:T.text5}}>{groupMessages[groupMessages.length-1].time}</div>}
        </div>

        {/* DIRECT MESSAGES: Quick start */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:T.text4,marginBottom:8}}>Личные сообщения</div>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
            {members.filter(m=>m.id!==meId&&!m.frozen).map(m=>(
              <div key={m.id} onClick={()=>{setPeer(m);setView("thread");}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",flexShrink:0}}>
                <Avatar member={m} size={40} />
                <div style={{fontSize:10,color:T.text3,maxWidth:48,textAlign:"center",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {convs.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"24px 0",fontSize:13}}>Нет переписок — выбери участника выше</div>}
        {convs.map(({member:m,thread,last,unread})=>(
          <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 13px",
              background:T.card,border:`1px solid ${T.border}`,borderRadius:13,marginBottom:8}}
            onMouseEnter={e=>e.currentTarget.style.background=T.border}
            onMouseLeave={e=>e.currentTarget.style.background=T.card}>
            <div onClick={()=>openThread(m)} style={{display:"flex",alignItems:"center",gap:12,flex:1,cursor:"pointer",minWidth:0}}>
              <div style={{position:"relative",flexShrink:0}}>
                <Avatar member={m} size={42} />
                {unread>0&&<div style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",
                  background:"#6366f1",fontSize:9,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</div>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:T.text,marginBottom:2}}>{m.name}</div>
                <div style={{fontSize:12,color:T.text4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {last ? (last.from===meId?"Вы: ":"")+last.text : "Нет сообщений"}
                </div>
              </div>
              {last&&<div style={{fontSize:10,color:T.text5,flexShrink:0}}>{last.time}</div>}
            </div>
            <button onClick={()=>onSelectMember&&onSelectMember(m.id)}
              style={{background:"none",border:`1px solid ${T.border}`,color:T.text4,fontSize:12,padding:"4px 8px",
                borderRadius:7,cursor:"pointer",flexShrink:0}}>👤</button>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── REVIEW FORM ──────────────────────────────────────────────────────────────
function ReviewForm({ tx, members, meId, onSave, onClose, T }) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const isOut = tx.from === meId;
  const other = isOut ? findM(members, tx.to) : findM(members, tx.from);
  return (
    <Sheet T={T} onClose={onClose}>
      <div style={{fontSize:17,fontWeight:700,marginBottom:4,color:T.text}}>Оставить отзыв</div>
      <div style={{fontSize:13,color:T.text3,marginBottom:14}}>
        Сделка: <span style={{color:T.text2,fontWeight:500}}>{tx.what}</span>
        {" · "}<span style={{color:"#6366f1",cursor:"pointer"}}>{other.name}</span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,justifyContent:"center"}}>
        {[1,2,3,4,5].map(s=>(
          <div key={s} onClick={()=>setStars(s)}
            style={{fontSize:30,cursor:"pointer",opacity:s<=stars?1:0.25,transition:"opacity 0.1s"}}>⭐</div>
        ))}
      </div>
      <SL T={T}>Комментарий (необязательно)</SL>
      <FI T={T} value={text} onChange={setText} placeholder="Как прошла сделка?" multi />
      <PB T={T} onClick={()=>onSave({txId:tx.id,from:meId,to:other.id,stars,text,date:today(),what:tx.what})}>
        Опубликовать отзыв
      </PB>
    </Sheet>
  );
}

// ─── REVIEWS DISPLAY ─────────────────────────────────────────────────────────
function ReviewsList({ reviews, members, T }) {
  if(!reviews||reviews.length===0) return (
    <div style={{textAlign:"center",color:T.text5,padding:"18px 0",fontSize:13}}>Отзывов пока нет</div>
  );
  const avg = reviews.reduce((s,r)=>s+r.stars,0)/reviews.length;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",
        background:T.card,borderRadius:12,border:`1px solid ${T.border}`}}>
        <div style={{fontSize:28,fontWeight:700,color:T.text}}>{avg.toFixed(1)}</div>
        <div>
          <div style={{display:"flex",gap:2}}>
            {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:14,opacity:s<=Math.round(avg)?1:0.25}}>⭐</span>)}
          </div>
          <div style={{fontSize:11,color:T.text4,marginTop:2}}>{reviews.length} {reviews.length===1?"отзыв":reviews.length<=4?"отзыва":"отзывов"}</div>
        </div>
      </div>
      {reviews.map((r,i)=>{
        const author = findM(members,r.from);
        return <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,
          padding:"11px 13px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Avatar member={author} size={28} />
              <div>
                <div style={{fontWeight:600,fontSize:13,color:T.text}}>{author.name.split(" ")[0]}</div>
                <div style={{fontSize:10,color:T.text5,fontFamily:"monospace"}}>{r.date}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:1}}>
              {[1,2,3,4,5].map(s=><span key={s} style={{fontSize:12,opacity:s<=r.stars?1:0.2}}>⭐</span>)}
            </div>
          </div>
          {r.text&&<div style={{fontSize:13,color:T.text2,lineHeight:1.4,fontStyle:"italic"}}>«{r.text}»</div>}
          <div style={{fontSize:11,color:T.text5,marginTop:4}}>Сделка: {r.what}</div>
        </div>;
      })}
    </div>
  );
}

// ─── CONSTITUTION SCREEN ─────────────────────────────────────────────────────
function RuleCard({ rule, T }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:8}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.background=T.border}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <div style={{width:38,height:38,borderRadius:10,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{rule.icon}</div>
        <div style={{fontWeight:600,fontSize:14,color:T.text,flex:1}}>{rule.title}</div>
        <div style={{color:T.text4,fontSize:16,transition:"transform 0.2s",transform:open?"rotate(180deg)":"rotate(0deg)"}}>▾</div>
      </div>
      {open&&<div style={{padding:"0 16px 16px",fontSize:13,color:T.text2,lineHeight:1.6,borderTop:`1px solid ${T.border}`}}>
        <div style={{paddingTop:12,whiteSpace:"pre-line"}}>{rule.text}</div>
      </div>}
    </div>
  );
}

function ConstitutionScreen({ onBack, T }) {
  const swipe = useSwipe(onBack);
  const DR = (DEMURRAGE_RATE*100).toFixed(0);
  const RULES = [
    { icon:"🌾", title:"Что такое зерно",
      text:"Зерно — внутренняя расчётная единица Общего фонда. Это не деньги и не криптовалюта. Зёрна не покупаются и не продаются за рубли. Они возникают в момент первой сделки и отражают взаимные обязательства участников." },
    { icon:"💱", title:"Обменный курс: как выставлять цену",
      text:["1 зерно ≈ 1 000 рублей рыночной стоимости.",
            "",
            "Цены в фонде — на 10–20% ниже рыночных. Это и есть привилегия сообщества: свои услуги и товары ты предлагаешь по-своему.",
            "",
            "Примеры:",
            "• Аренда дома 10 000 ₽/нед → 8 зёрен (скидка 20%)",
            "• Урок английского 1 500 ₽ → 1,5 зерна",
            "• Помощь с переездом 3 000 ₽ → 2,5 зерна",
            "",
            "Можно выставить 0,5 зерна. Бесплатные предложения тоже ценны.",
            "",
            "Главное: цена должна отражать реальный вклад, а не быть символической."].join("\n") },
    { icon:"⚖️", title:"Нулевой старт и баланс",
      text:"Каждый участник начинает с нулевого баланса. Чтобы получить зёрна — предложи что-то ценное сообществу. Отрицательный баланс означает, что ты взял больше, чем дал — это нормально: система работает на доверии, а не страхе." },
    { icon:"🔄", title:"Как проходит сделка",
      text:["1. Покупатель бронирует предложение.",
            "2. После получения — подтверждает сделку.",
            "3. Зёрна переходят от покупателя к продавцу.",
            "4. Отменить активную сделку можно до подтверждения.",
            "5. После подтверждения можно оставить отзыв."].join("\n") },
    { icon:"📉", title:"Демередж — плата за хранение",
      text:["Демередж — постепенное «таяние» накопленных зёрен. Цель: стимулировать оборот, а не накопление.",
            "",
            "• Ставка: " + DR + "% в месяц",
            "• Применяется только к сумме сверх " + DEMURRAGE_THRESHOLD + " зёрен",
            "• Отсчёт с момента последней сделки",
            "",
            "Пример: у тебя 120 зёрен, 2 месяца без активности →",
            "демередж = (120 − " + DEMURRAGE_THRESHOLD + ") × " + DR + "% × 2 = " + ((120-DEMURRAGE_THRESHOLD)*DEMURRAGE_RATE*2).toFixed(1) + " зерна"].join("\n") },
    { icon:"🎁", title:"Дары",
      text:"Дар — безусловная передача зёрен без ожидания ответной услуги. Подарить можно только при положительном балансе и не больше, чем у тебя есть. Дары видны в реестре и формируют репутацию." },
    { icon:"📋", title:"Запросы",
      text:"Если тебе нужна помощь — создай запрос. Участники могут откликнуться с предложением цены. Ты принимаешь лучшее предложение — и сразу создаётся сделка. Открытый запрос можно отменить в любой момент." },
    { icon:"🔒", title:"Инвайты и вступление",
      text:"В Общий фонд можно войти только по инвайт-коду от действующего участника. Это сохраняет доверие и качество сообщества. Каждый участник несёт ответственность за тех, кого пригласил." },
    { icon:"🏡", title:"Живи по средствам",
      text:["Основной принцип фонда: не бери больше, чем готов отдать.",
            "",
            "Отрицательный баланс — это не штраф, это обязательство перед сообществом. Ты взял ценность и обязан вернуть её в другой форме.",
            "",
            "• Не накапливай долг без плана как его закрыть",
            "• Если баланс уходит в минус — выставляй предложения и берись за запросы",
            "• Фонд существует на взаимности: каждое зерно доверия — это чья-то реальная услуга",
            "",
            "Участник с хроническим минусом без активных предложений может быть исключён из фонда."].join("\n") },
    { icon:"📊", title:"Прозрачность и реестр",
      text:"Все транзакции публичны и видны в Реестре. Балансы участников отображаются на их профилях. Это основа взаимного доверия — каждый видит, кто даёт и кто берёт." },
    { icon:"🌐", title:"Граф связей",
      text:"Вкладка Граф показывает визуальную сеть всех обменов. Чем больше сделок — тем плотнее связи. Это помогает видеть, кто с кем взаимодействует и где концентрируется активность." },

  ];

  return (
    <div style={{animation:"fadeUp 0.25s ease",minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}} {...swipe}>
      <div style={{padding:"18px 20px 0",display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.text4,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0}}>← назад</button>
        <div style={{fontSize:19,fontWeight:700}}>📜 Правила фонда</div>
      </div>
      <div style={{padding:"12px 20px 32px"}}>
        <div style={{background:"#6366f115",border:"1px solid #6366f130",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:13,color:"#818cf8",lineHeight:1.5,fontWeight:500}}>
            Общий фонд — сообщество взаимопомощи на основе доверия и внутренней валюты «зерно». Никаких посредников — только прямой обмен между людьми.
          </div>
        </div>
        {RULES.map((r,i)=><RuleCard key={i} rule={r} T={T} />)}
        <div style={{textAlign:"center",fontSize:11,color:T.text5,marginTop:12,fontFamily:"monospace"}}>
          Правила v{APP_VERSION} · Общий фонд 2025
        </div>
      </div>
    </div>
  );
}


// ─── GIFT MEMBER PICKER ───────────────────────────────────────────────────────
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


// ─── CSS ──────────────────────────────────────────────────────────────────────
const GCSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{display:none;}input,textarea{outline:none;}
  html,body{background:#0d0f14;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(30px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes slideOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(100%)}}
  @keyframes slideLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
  @keyframes slideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
  @keyframes notif{0%{opacity:0;transform:translateX(-50%) translateY(-8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-8px)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .tab-enter-left{animation:slideLeft 0.22s cubic-bezier(0.25,0.46,0.45,0.94)}
  .tab-enter-right{animation:slideRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)}
`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [meId,         setMeId]         = useState(null);
  const [themeKey, setThemeKey] = useState(()=>{
    try { return localStorage.getItem("of_theme")||"dark"; } catch(e){ return "dark"; }
  });
  const T = THEMES[themeKey] || THEMES.dark;
  useEffect(()=>{
    try { localStorage.setItem("of_theme", themeKey); } catch(e){}
    document.body.style.background = (THEMES[themeKey]||THEMES.dark).bg;
  },[themeKey]);
  const [loading,      setLoading]      = useState(true);
  const [dbError,      setDbError]      = useState(null);
  const [accounts,     setAccounts]     = useState([]);
  const [members,      setMembers]      = useState([]);
  const [offers,       setOffers]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [requests,     setRequests]     = useState([]);
  const [invites,      setInvites]      = useState([]);
  const [balances,     setBalances]     = useState({});
  const [news,         setNews]         = useState([]);
  const [notifications,setNotifications]= useState([]);
  const [notif,        setNotif]        = useState(null);
  const [view,         setView_]        = useState("main");
  const [viewStack,    setViewStack]    = useState([]);
  function setView(v){setViewStack(s=>v==="main"?[]:[...s,view]);setView_(v);}
  function goBack(){if(viewStack.length>0){const prev=viewStack[viewStack.length-1];setViewStack(s=>s.slice(0,-1));setView_(prev);}else{setView_("main");}}
  const [profileTarget,setProfileTarget]= useState(null);
  const [tab,          setTab]          = useState("offers");
  const [catFilter,    setCatFilter]    = useState("Все");
  const [search,       setSearch]       = useState("");
  const [selOffer,     setSelOffer]     = useState(null);
  const [bookQty,      setBookQty]      = useState(1);
  const [txNote,       setTxNote]       = useState("");
  const [showGift,     setShowGift]     = useState(false);
  const [giftTo,       setGiftTo]       = useState(null);
  const [giftAmt,      setGiftAmt]      = useState(10);
  const [giftCustom,   setGiftCustom]   = useState("");
  const [giftMsg,      setGiftMsg]      = useState("");
  const [addingReq,    setAddingReq]    = useState(false);
  const [addingOff,    setAddingOff]    = useState(false);
  const [openReq,      setOpenReq]      = useState(null);
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [showConstitution, setShowConstitution] = useState(false);
  const [messages,     setMessages]     = useState([]); // {from, to, text, time, ts, read
  const [groupMessages,setGroupMessages]= useState([]);  // {from, text, time, ts}}
  const [reviews,      setReviews]      = useState([]); // {txId, from, to, stars, text, date, what}
  const [lightbox,     setLightbox]     = useState(null); // photo src
  const [categories,   setCategories]   = useState(CATEGORIES); // manageable
  const [showReviewFor, setShowReviewFor] = useState(null); // tx object

  const me        = members.find(m=>m.id===meId);
  const [negLimit, setNegLimit] = useState(DEFAULT_NEG_LIMIT);

  // ─── LOAD ALL DATA FROM SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        const [
          rawMembers, rawAccounts, rawOffers, rawBids,
          rawRequests, rawTxs, rawReviews, rawMsgs,
          rawNotifs, rawInvites, rawNews, rawCats, rawSettings
        ] = await Promise.all([
          sb.select("members", "order=joined.asc"),
          sb.select("accounts"),
          sb.select("offers", "order=created_at.desc"),
          sb.select("bids"),
          sb.select("requests", "order=created_at.desc"),
          sb.select("transactions", "order=created_at.desc"),
          sb.select("reviews"),
          sb.select("messages", "order=date.asc"),
          sb.select("notifications", "order=date.desc"),
          sb.select("invites"),
          sb.select("news", "order=date.desc"),
          sb.select("categories", "order=sort_order.asc"),
          sb.select("settings"),
        ]);

        const members = rawMembers.map(toMember);
        setMembers(members);
        setAccounts(rawAccounts.map(r=>({ login:r.login, password:r.password, memberId:r.member_id })));

        const offers = rawOffers.map(toOffer);
        setOffers(offers);

        const bids = rawBids;
        const requests = rawRequests.map(r=>toRequest(r, bids));
        setRequests(requests);

        const txs = rawTxs.map(toTx);
        setTransactions(txs);
        setBalances(initBalances(members, txs));

        setReviews(rawReviews.map(toReview));
        const allMsgs = rawMsgs.map(toMsg);
        setMessages(allMsgs.filter(m=>!m.isGroup));
        setGroupMessages(allMsgs.filter(m=>m.isGroup));
        setNotifications(rawNotifs.map(toNotif));
        setInvites(rawInvites.map(toInvite));
        setNews(rawNews);

        if(rawCats.length>0) {
          const catNames = rawCats.map(c=>c.name);
          setCategories(["Все", ...catNames]);
          rawCats.forEach(c=>{ if(c.icon) CAT_ICONS[c.name]=c.icon; });
        }

        const negLimitSetting = rawSettings.find(s=>s.key==="neg_limit");
        if(negLimitSetting) setNegLimit(Number(negLimitSetting.value));

        // Restore session
        const savedMe = localStorage.getItem("of_me");
        if(savedMe) setMeId(savedMe);

      } catch(e) {
        console.error("Load error:", e);
        setDbError("Не удалось подключиться к базе данных. Проверь интернет.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // ─── POLLING: refresh every 5 sec when logged in ──────────────────────────
  useEffect(() => {
    if(!meId || loading) return;
    const iv = setInterval(async () => {
      const [rawNotifs, rawMsgs, rawTxs, rawOffers, rawRequests, rawBids] = await Promise.all([
        sb.select("notifications", `member_id=eq.${meId}&order=date.desc`),
        sb.select("messages", "order=date.asc"),
        sb.select("transactions", "order=created_at.desc"),
        sb.select("offers", "order=created_at.desc"),
        sb.select("requests", "order=created_at.desc"),
        sb.select("bids"),
      ]);
      setNotifications(rawNotifs.map(toNotif));
      const allMsgs = rawMsgs.map(toMsg);
      setMessages(allMsgs.filter(m=>!m.isGroup));
      setGroupMessages(allMsgs.filter(m=>m.isGroup));
      const txs = rawTxs.map(toTx);
      setTransactions(txs);
      setOffers(rawOffers.map(toOffer));
      const requests = rawRequests.map(r=>toRequest(r, rawBids));
      setRequests(requests);
      setMembers(prev => {
        setBalances(initBalances(prev, txs));
        return prev;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, [meId, loading]);
  const myBalance = balances[meId]||0;
  const myRole    = me?.systemRole||ROLES.member;
  const myNotifs  = notifications.filter(n=>n.memberId===meId&&!n.read);

  const TABS_DEF = [
    {key:"news",    l:"Новости"},
    {key:"offers",  l:"Предложения"},
    {key:"requests",l:"Запросы"},
    {key:"members", l:"Участники"},
    {key:"graph",   l:"Граф"},
    {key:"ledger",  l:"Реестр"},
  ];

  const tabKeys = TABS_DEF.map(t=>t.key);
  const tabIdx  = tabKeys.indexOf(tab);
  const [tabDir, setTabDir] = useState(null); // "left" | "right"
  const [tabKey, setTabKey] = useState(0); // force re-render for animation

  // Pull-to-refresh state
  const scrollRef = useRef(null);
  const ptrStartY = useRef(null);
  const [ptrPull, setPtrPull] = useState(0);   // px pulled (0..80)
  const [ptrDone, setPtrDone] = useState(false); // "refreshing" state
  const PTR_THRESHOLD = 70;

  const ptrTouchStart = useCallback(e => {
    const el = scrollRef.current;
    if(el && el.scrollTop === 0) ptrStartY.current = e.touches[0].clientY;
  }, []);
  const ptrTouchMove = useCallback(e => {
    if(ptrStartY.current === null) return;
    const dy = e.touches[0].clientY - ptrStartY.current;
    if(dy > 0) setPtrPull(Math.min(dy * 0.5, 80));
  }, []);
  const ptrTouchEnd = useCallback(() => {
    if(ptrPull >= PTR_THRESHOLD) {
      setPtrDone(true);
      setPtrPull(PTR_THRESHOLD);
      setTimeout(() => window.location.reload(), 500);
    } else {
      setPtrPull(0);
    }
    ptrStartY.current = null;
  }, [ptrPull]);

  const changeTab = useCallback((newTab, dir) => {
    setTabDir(dir);
    setTabKey(k=>k+1);
    setTab(newTab);
  }, []);

  const swipeMain = useSwipe(
    ()=>tabIdx>0&&changeTab(tabKeys[tabIdx-1],"right"),
    ()=>tabIdx<tabKeys.length-1&&changeTab(tabKeys[tabIdx+1],"left")
  );

  const doRefresh = useCallback(async () => {
    try {
      const [rawNotifs, rawMsgs, rawTxs, rawOffers, rawRequests, rawBids] = await Promise.all([
        sb.select("notifications", `member_id=eq.${meId}&order=date.desc`),
        sb.select("messages", "order=date.asc"),
        sb.select("transactions", "order=created_at.desc"),
        sb.select("offers", "order=created_at.desc"),
        sb.select("requests", "order=created_at.desc"),
        sb.select("bids"),
      ]);
      setNotifications(rawNotifs.map(toNotif));
      const allMsgs = rawMsgs.map(toMsg);
      setMessages(allMsgs.filter(m=>!m.isGroup));
      setGroupMessages(allMsgs.filter(m=>m.isGroup));
      setTransactions(rawTxs.map(toTx));
      setOffers(rawOffers.map(toOffer));
      setRequests(rawRequests.map(r=>toRequest(r, rawBids)));
    } catch(e) { console.error("refresh", e); }
  }, [meId]);

  function notify(msg){setNotif(msg);setTimeout(()=>setNotif(null),2800);}
  async function addNotification(memberId,type,text){
    const id=uid();
    await sb.insert("notifications",{id,member_id:memberId,type,body:text,date:today(),read:false});
    setNotifications(p=>[{id,memberId,type,text,date:today(),read:false},...p]);
  }

  // ── AUTH ──
  function handleLogin(memberId){
    setMeId(memberId);
    localStorage.setItem("of_me", memberId);
    setTab("offers");
    setGiftTo(members.find(m=>m.id!==memberId)?.id);
  }
  function handleLogout(){
    setMeId(null);
    localStorage.removeItem("of_me");
    setView_("main");
    setViewStack([]);
  }
  async function handleRegister({invCode,name,login,password,profession,bio,telegram}){
    const inv=invites.find(i=>i.code===invCode&&!i.usedBy);if(!inv)return;
    // Double-submit guard: check invite not already used in DB
    const freshInvites = await sb.select("invites",`code=eq.${invCode}`);
    if(freshInvites?.[0]?.used_by) return; // already registered
    const invitedBy=inv.createdBy||null;
    const initials=name.trim().split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
    const newId=uid();
    const today_=today().slice(0,7);
    // Write to Supabase
    await sb.insert("members",{id:newId,name,profession:profession||"",bio:bio||"",
      telegram:telegram||null,joined:today_,invited_by:invitedBy,
      system_role:"member",frozen:false,helpful:""});
    await sb.insert("accounts",{id:uid(),member_id:newId,login,password});
    await sb.upsert("balances",{member_id:newId,amount:0},"member_id");
    await sb.update("invites",{id:inv.id},{used_by:newId,used_at:today()});
    // Update local state
    const newMember={id:newId,name,avatar:initials,photo:null,systemRole:ROLES.member,
      profession,bio,helpful:"",skills:[],balance:0,joined:today_,
      telegram:telegram||null,instagram:null,invitedBy,frozen:false};
    setMembers(p=>[...p,newMember]);
    setBalances(p=>({...p,[newId]:0}));
    setInvites(p=>p.map(i=>i.id===inv.id?{...i,usedBy:newId}:i));
    setAccounts(p=>[...p,{login,password,memberId:newId}]);
    if(invitedBy) addNotification(invitedBy,"invite_used",`${name} принял ваш инвайт`);
    setGiftTo(members[0]?.id);
    handleLogin(newId);
    notify(`Добро пожаловать, ${name.split(" ")[0]}! 🌾`);
  }

  // ── navigate to member ──
  function goToMember(id){const m=members.find(x=>x.id===id);if(!m)return;setProfileTarget(m);setView("profile");}

  // ── offers ──
  async function addOffer(data){
    const id=uid();
    await sb.insert("offers",{id,member:meId,title:data.title,category:data.category,
      price:data.price,unit:data.unit,qty:data.qty,reserved:0,available:true,
      description:data.desc||"",photo:data.photo||null,created_at:today()});
    setOffers(p=>[...p,{...data,id,member:meId,reserved:0,available:true}]);
    notify("✓ Предложение добавлено");
  }
  async function editOffer(id,data){
    await sb.update("offers",{id},{title:data.title,category:data.category,
      price:data.price,unit:data.unit,qty:data.qty,description:data.desc||"",photo:data.photo||null});
    setOffers(p=>p.map(o=>o.id===id?{...o,...data}:o));
    notify("✓ Обновлено");
  }
  async function toggleOffer(id){
    const o=offers.find(x=>x.id===id);
    await sb.update("offers",{id},{available:!o?.available});
    setOffers(p=>p.map(o=>o.id===id?{...o,available:!o.available}:o));
  }
  async function deleteOffer(id){
    const o=offers.find(x=>x.id===id);
    if(o?.reserved>0){notify("Нельзя — есть бронирования");return;}
    await sb.delete("offers",{id});
    setOffers(p=>p.filter(o=>o.id!==id));
    notify("Удалено");
  }

  // ── booking ──
  async function doBook(){if(!selOffer)return;
    if(selOffer.member===meId){notify("Нельзя забронировать своё предложение");return;}
    const qty=bookQty,total=selOffer.price*qty,seller=findM(members,selOffer.member);
    if((myBalance-total)<negLimit){notify(`Недостаточно зёрен. Лимит задолженности: ${cur(Math.abs(negLimit))}`);return;}
    const id=uid();
    await sb.insert("transactions",{id,type:"exchange",from_member:meId,to_member:selOffer.member,
      amount:total,qty,what:selOffer.title,date:today(),status:"active",
      offer_id:selOffer.id,created_at:today()});
    await sb.update("balances",{member_id:meId},{amount:myBalance-total});
    await sb.update("balances",{member_id:selOffer.member},{amount:(balances[selOffer.member]||0)+total});
    await sb.update("offers",{id:selOffer.id},{reserved:selOffer.reserved+qty});
    setTransactions(p=>[{id,from:meId,to:selOffer.member,amount:total,what:selOffer.title,offerId:selOffer.id,qty,date:today(),type:"exchange",status:"active"},...p]);
    setBalances(p=>({...p,[meId]:p[meId]-total,[selOffer.member]:(p[selOffer.member]||0)+total}));
    setOffers(p=>p.map(o=>o.id===selOffer.id?{...o,reserved:o.reserved+qty}:o));
    addNotification(selOffer.member,"booking",`${me.name} забронировал «${selOffer.title}»`);
    notify(`✓ Забронировано у ${seller.name}`);
    setSelOffer(null);setTxNote("");setBookQty(1);
  }
  async function confirmTx(txId){const tx=transactions.find(t=>t.id===txId);if(!tx)return;
    if(tx.status!=="active"&&tx.status!=="awaiting_confirm")return;
    const confirmedTx={...tx,status:"confirmed"};
    await sb.update("transactions",{id:txId},{status:"confirmed"});
    setTransactions(p=>p.map(t=>t.id===txId?confirmedTx:t));
    if(tx.offerId){
      const o=offers.find(x=>x.id===tx.offerId);
      if(o){
        const newReserved=Math.max(0,o.reserved-tx.qty);
        const newQty=Math.max(0,o.qty-tx.qty);
        await sb.update("offers",{id:tx.offerId},{reserved:newReserved,qty:newQty,available:newQty>0});
        setOffers(p=>p.map(o=>o.id===tx.offerId?{...o,reserved:newReserved,qty:newQty,available:newQty>0}:o));
      }
    }
    if(tx.reqId){
      const fromBal=(balances[tx.from]||0)-tx.amount;
      const toBal=(balances[tx.to]||0)+tx.amount;
      await sb.update("balances",{member_id:tx.from},{amount:fromBal});
      await sb.update("balances",{member_id:tx.to},{amount:toBal});
      await sb.update("requests",{id:tx.reqId},{status:"closed"});
      setBalances(p=>({...p,[tx.from]:fromBal,[tx.to]:toBal}));
      setRequests(p=>p.map(r=>r.id===tx.reqId?{...r,status:"closed"}:r));
    }
    addNotification(tx.to,"confirmed",`${me.name} подтвердил выполнение: «${tx.what}»`);
    notify("✓ Сделка завершена");
    setTimeout(()=>setShowReviewFor(confirmedTx),400);
    addNotification(tx.to,"review_prompt",`Оставьте отзыв о сделке «${tx.what}»`);}
  async function cancelTx(txId){const tx=transactions.find(t=>t.id===txId);if(!tx||(tx.status!=="active"&&tx.status!=="awaiting_confirm"))return;
    await sb.update("transactions",{id:txId},{status:"cancelled"});
    setTransactions(p=>p.map(t=>t.id===txId?{...t,status:"cancelled"}:t));
    if(tx.offerId){
      const fromBal=(balances[tx.from]||0)+tx.amount;
      const toBal=(balances[tx.to]||0)-tx.amount;
      await sb.update("balances",{member_id:tx.from},{amount:fromBal});
      await sb.update("balances",{member_id:tx.to},{amount:toBal});
      const o=offers.find(x=>x.id===tx.offerId);
      if(o) await sb.update("offers",{id:tx.offerId},{reserved:Math.max(0,o.reserved-tx.qty)});
      setBalances(p=>({...p,[tx.from]:fromBal,[tx.to]:toBal}));
      setOffers(p=>p.map(o=>o.id===tx.offerId?{...o,reserved:Math.max(0,o.reserved-tx.qty)}:o));
    }
    if(tx.reqId){
      await sb.update("requests",{id:tx.reqId},{status:"open",accepted_bid_id:null});
      const req=requests.find(r=>r.id===tx.reqId);
      if(req) req.bids.forEach(b=>sb.update("bids",{id:b.id},{status:"pending"}));
      setRequests(p=>p.map(r=>r.id===tx.reqId?{...r,status:"open",acceptedBidId:null,bids:r.bids.map(b=>({...b,status:"pending"}))}:r));
      const reqAuthorId=req?.member;
      if(reqAuthorId&&reqAuthorId!==meId) addNotification(reqAuthorId,"cancelled","Исполнитель отказался · запрос снова в каталоге");
    }
    notify("Отменено");}
  async function markDone(txId){
    const tx=transactions.find(t=>t.id===txId);if(!tx||tx.status!=="active")return;
    await sb.update("transactions",{id:txId},{status:"awaiting_confirm"});
    setTransactions(p=>p.map(t=>t.id===txId?{...t,status:"awaiting_confirm"}:t));
    addNotification(tx.from,"done",`Исполнитель выполнил «${tx.what}» · подтвердите завершение`);
    notify("✓ Отмечено как выполненное · ждём подтверждения заказчика");}

  // ── gift ──
  async function doGift(){
    const finalAmt=giftCustom?Number(giftCustom):giftAmt;
    if(!finalAmt||finalAmt<=0)return;
    if(myBalance<=0){notify("Нельзя дарить с нулевым или отрицательным балансом");return;}
    if(finalAmt>myBalance){notify(`Недостаточно зёрен. Можно подарить не больше ${cur(myBalance)}`);return;}
    const r=findM(members,giftTo);
    const id=uid();
    const newFromBal=myBalance-finalAmt;
    const newToBal=(balances[giftTo]||0)+finalAmt;
    await sb.insert("transactions",{id,type:"gift",from_member:meId,to_member:giftTo,
      amount:finalAmt,qty:1,what:"Дар",date:today(),status:"confirmed",created_at:today()});
    await sb.update("balances",{member_id:meId},{amount:newFromBal});
    await sb.update("balances",{member_id:giftTo},{amount:newToBal});
    setTransactions(p=>[{id,from:meId,to:giftTo,amount:finalAmt,what:"Дар",offerId:null,qty:1,date:today(),type:"gift",status:"confirmed"},...p]);
    setBalances(p=>({...p,[meId]:newFromBal,[giftTo]:newToBal}));
    addNotification(giftTo,"gift",`${me.name} подарил вам ${cur(finalAmt)}`);
    notify(`💛 Дар передан ${r.name}`);setShowGift(false);setGiftMsg("");setGiftCustom("");
  }

  // ── requests ──
  async function addRequest(data){
    const id=uid();
    await sb.insert("requests",{id,member:meId,title:data.title,category:data.category||"Все",
      description:data.desc||"",budget:data.budget||null,status:"open",created_at:today()});
    setRequests(p=>[{...data,id,member:meId,date:today(),status:"open",bids:[],acceptedBidId:null},...p]);
    notify("✓ Запрос опубликован");
  }
  async function cancelRequest(reqId){
    await sb.update("requests",{id:reqId},{status:"cancelled"});
    setRequests(p=>p.map(r=>r.id!==reqId?r:{...r,status:"cancelled"}));
    notify("Запрос отменён");
  }
  async function addBid(reqId,price,note){
    const bidId=uid();
    await sb.insert("bids",{id:bidId,request_id:reqId,from_member:meId,price,note:note||"",status:"pending",created_at:today()});
    const req=requests.find(x=>x.id===reqId);
    if(req) addNotification(req.member,"bid",`${me.name} откликнулся на «${req.title}» — ${cur(price)}`);
    setRequests(p=>p.map(r=>r.id!==reqId?r:{...r,bids:[...r.bids,{id:bidId,from:meId,price,note:note||"",status:"pending"}]}));
    notify("✓ Предложение отправлено");
  }
  async function acceptBid(reqId,bidId){const req=requests.find(r=>r.id===reqId);const bid=req?.bids.find(b=>b.id===bidId);if(!req||!bid)return;
    const authorBal=balances[req.member]||0;
    if((authorBal-bid.price)<negLimit){notify("Недостаточно зёрен для принятия этого предложения");return;}
    const newTxId=uid();
    const newTx={id:newTxId,from:req.member,to:bid.from,amount:bid.price,what:req.title,offerId:null,qty:1,date:today(),type:"exchange",status:"active",reqId};
    await sb.insert("transactions",{id:newTxId,type:"exchange",from_member:req.member,to_member:bid.from,
      amount:bid.price,qty:1,what:req.title,date:today(),status:"active",req_id:reqId,created_at:today()});
    await sb.update("requests",{id:reqId},{status:"in_progress",accepted_bid_id:bidId});
    await sb.update("bids",{id:bidId},{status:"accepted"});
    req.bids.filter(b=>b.id!==bidId).forEach(b=>sb.update("bids",{id:b.id},{status:"declined"}));
    setTransactions(p=>[newTx,...p]);
    setRequests(p=>p.map(r=>r.id!==reqId?r:{...r,status:"in_progress",acceptedBidId:bidId,bids:r.bids.map(b=>b.id===bidId?{...b,status:"accepted"}:{...b,status:"declined"})}));
    addNotification(bid.from,"accepted",`${me.name} принял ваш отклик на «${req.title}» · приступайте!`);
    notify("✓ Исполнитель выбран · ждём выполнения");}
  async function declineBid(reqId,bidId){
    await sb.update("bids",{id:bidId},{status:"declined"});
    setRequests(p=>p.map(r=>r.id!==reqId?r:{...r,bids:r.bids.map(b=>b.id===bidId?{...b,status:"declined"}:b)}));
  }
  async function cancelBid(reqId,bidId){
    await sb.update("bids",{id:bidId},{status:"withdrawn"});
    setRequests(p=>p.map(r=>r.id!==reqId?r:{...r,bids:r.bids.map(b=>b.id===bidId?{...b,status:"withdrawn"}:b)}));
    notify("✓ Отклик отозван");
  }

  // ── profile ──
  async function updateProfile(id,data){
    const dbData={};
    if(data.name!==undefined) dbData.name=data.name;
    if(data.profession!==undefined) dbData.profession=data.profession;
    if(data.bio!==undefined) dbData.bio=data.bio;
    if(data.photo!==undefined) dbData.photo=data.photo;
    if(data.telegram!==undefined) dbData.telegram=data.telegram;
    if(data.instagram!==undefined) dbData.instagram=data.instagram;
    if(data.helpful!==undefined) dbData.helpful=data.helpful;
    if(Object.keys(dbData).length>0) await sb.update("members",{id},dbData);
    setMembers(p=>p.map(m=>m.id===id?{...m,...data}:m));
    notify("✓ Профиль обновлён");
  }
  async function createInvite(){
    const code=genCode();
    const id=uid();
    await sb.insert("invites",{id,code,created_by:meId,created_at:today()});
    setInvites(p=>[...p,{id,code,createdBy:meId,usedBy:null,createdAt:today()}]);
    notify(`Инвайт: ${code}`);
  }

  // ── admin actions ──
  async function freezeToggle(id){
    const m=members.find(x=>x.id===id);
    await sb.update("members",{id},{frozen:!m?.frozen});
    setMembers(p=>p.map(m=>m.id===id?{...m,frozen:!m.frozen}:m));
    notify(m?.frozen?"Участник разморожен":"Участник заморожен");
  }
  async function deleteMember(id){
    const m=members.find(x=>x.id===id);const bal=balances[id]||0;
    if(bal>0){
      const txId=uid();
      await sb.insert("transactions",{id:txId,type:"gift",from_member:id,to_member:null,
        amount:bal,qty:1,what:"Баланс при удалении",date:today(),status:"confirmed",created_at:today()});
    }
    await sb.update("members",{id},{frozen:true,system_role:"deleted"});
    setMembers(p=>p.filter(m=>m.id!==id));
    setBalances(p=>{const n={...p};delete n[id];return n;});
    setOffers(p=>p.map(o=>o.member===id?{...o,available:false}:o));
    setView("main");notify(`Участник удалён. Транзакции сохранены.`);
  }
  async function setRole(id,role){
    await sb.update("members",{id},{system_role:role});
    setMembers(p=>p.map(m=>m.id===id?{...m,systemRole:role}:m));
    notify(`Роль изменена: ${ROLE_LABEL[role]}`);
  }
  async function addNews(data){
    const id=uid();
    await sb.insert("news",{id,title:data.title,body:data.body,pinned:data.pinned||false,author:meId,date:today()});
    setNews(p=>[{...data,id,author:meId,date:today()},...p]);
    notify("✓ Новость опубликована");
  }
  function deleteNews(id){setNews(p=>p.filter(n=>n.id!==id));}

  // ── chat ──
  async function sendMessage(from, to, text) {
    if(text===null) { // mark-read call
      const unread=messages.filter(m=>m.to===meId&&m.from===to&&!m.read);
      setMessages(p=>p.map(m=>m.to===meId&&m.from===to?{...m,read:true}:m));
      for(const msg of unread) sb.update("messages",{id:msg.id},{read:true});
      return;
    }
    const now = new Date();
    const time = now.toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"});
    const id=uid();
    const isGroup=(to==="group");
    await sb.insert("messages",{id,from_member:from,to_member:isGroup?"group":to,
      body:text,date:time,is_group:isGroup});
    if(isGroup) {
      setGroupMessages(p=>[...p,{id,from,text,time,ts:now.getTime()}]);
    } else {
      setMessages(p=>[...p,{id,from,to,text,time,ts:now.getTime(),read:false}]);
      addNotification(to,"chat",`${me.name}: ${text.slice(0,40)}`);
    }
  }

  // ── reviews ──
  async function addReview(data) {
    const id=uid();
    await sb.insert("reviews",{id,tx_id:data.txId,from_member:data.from,to_member:data.to,
      stars:data.stars,body:data.text||"",date:today()});
    setReviews(p=>[...p,{...data,id}]);
    addNotification(data.to,"review",`${me.name} оставил отзыв ⭐${data.stars}`);
    notify("✓ Отзыв опубликован");
  }

  // ── categories ──
  async function addCategory(name, icon) {
    if(!name.trim()) return;
    const id=uid();
    const sortOrder=categories.length;
    await sb.insert("categories",{id,name:name.trim(),icon:icon||"✦",sort_order:sortOrder});
    CAT_ICONS[name.trim()] = icon||"✦";
    setCategories(p=>[...p, name.trim()]);
    notify(`✓ Категория «${name.trim()}» добавлена`);
  }
  async function editCategoryIcon(name, icon) {
    CAT_ICONS[name] = icon;
    const cats = await sb.select("categories",`name=eq.${encodeURIComponent(name)}`);
    if(cats[0]) await sb.update("categories",{icon},`id=eq.${cats[0].id}`);
    setCategories(p=>[...p]); // force re-render
    notify("✓ Иконка обновлена");
  }
  async function deleteCategory(name) {
    const cats=await sb.select("categories",`name=eq.${encodeURIComponent(name)}`);
    if(cats[0]) await sb.delete("categories",{id:cats[0].id});
    setCategories(p=>p.filter(c=>c!==name&&c!=="Все"));
    notify(`Категория удалена`);
  }
  function moveCategory(name, dir) {
    setCategories(p=>{
      const arr=[...p];
      const i=arr.indexOf(name);
      const j=i+dir;
      if(j<1||j>=arr.length)return arr;
      [arr[i],arr[j]]=[arr[j],arr[i]];
      return arr;
    });
  }

  if(loading) return (
    <div style={{background:"#0d0f14",minHeight:"100vh",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:16,fontFamily:"DM Sans,sans-serif"}}>
      <div style={{fontSize:48}}>🌾</div>
      <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0"}}>Общий фонд</div>
      {dbError
        ? <div style={{color:"#f87171",fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.5}}>{dbError}<br/><br/>
            <span style={{fontSize:11,color:"#475569"}}>Проверь ключи Supabase в коде (SUPA_URL, SUPA_KEY)</span></div>
        : <div style={{color:"#475569",fontSize:13}}>Загрузка данных…</div>
      }
    </div>
  );
  if(!meId) return <AuthScreen T={T} invites={invites} members={members} accounts={accounts} onLogin={handleLogin} onRegister={handleRegister} />;

  const sl=search.toLowerCase().trim();
  const filtOffers=offers.filter(o=>{
    const inC=catFilter==="Все"||o.category===catFilter;
    const inS=matchSearch({...o,category:o.category},sl);
    return inC&&inS&&o.available&&(o.qty-o.reserved)>0&&!members.find(m=>m.id===o.member)?.frozen;
  });
  const filtReqs=requests.filter(r=>{
    if(r.status==="cancelled"||r.status==="closed") return false; // completed/cancelled not shown
    const inC=catFilter==="Все"||r.category===catFilter||r.category==="Все";
    const inS=!sl||matchSearch({title:r.title,desc:r.desc,category:r.category},sl);
    return inC&&inS;
  });
  const pinnedNews=news.filter(n=>n.pinned);
  const allNews=[...news].sort((a,b)=>b.pinned-a.pinned);

  const WRAP={minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'DM Sans','Segoe UI',sans-serif"};
  const INNER={maxWidth:520,margin:"0 auto",position:"relative"};

  if(showConstitution) return <div style={WRAP}><style>{GCSS}</style>
    <div style={INNER}><ConstitutionScreen T={T} onBack={()=>setShowConstitution(false)}/></div></div>;

  if(view==="chat") return <div style={WRAP}><style>{GCSS}</style>{notif&&<Notif msg={notif}/>}
    <div style={INNER}><ChatScreen meId={meId} members={members} messages={messages}
      onSend={sendMessage} onBack={goBack} groupMessages={groupMessages} T={T} onSelectMember={goToMember}/>
    <VersionFooter T={T}/></div></div>;

  if(view==="tasks") return <div style={WRAP}><style>{GCSS}</style>{notif&&<Notif msg={notif}/>}
    <div style={INNER}><MyTasksScreen meId={meId} members={members} transactions={transactions}
      requests={requests} T={T} onBack={goBack}
      onConfirmTx={confirmTx} onCancelTx={cancelTx} onMarkDone={markDone} onCancelRequest={cancelRequest} onCancelBid={cancelBid} onSelectMember={goToMember} onOpenReq={(r)=>{setOpenReq(r);setView("main");}} reviews={reviews} onReview={setShowReviewFor}/>
    <VersionFooter T={T}/></div></div>;

  if(view==="admin") return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={INNER}><AdminPanel members={members} offers={offers} transactions={transactions}
      invites={invites} balances={balances} news={news} meId={meId} T={T}
      onCreateInvite={createInvite} onBack={goBack}
      onSelectMember={goToMember} onFreezeToggle={freezeToggle}
      onDeleteMember={deleteMember} onSetRole={setRole}
      onAddNews={addNews} onDeleteNews={deleteNews} negLimit={negLimit} onSetNegLimit={async (v)=>{
              await sb.upsert("settings",{key:"neg_limit",value:String(v)},"key");
              setNegLimit(v);
            }}
      categories={categories} onAddCategory={addCategory} onDeleteCategory={deleteCategory} onMoveCategory={moveCategory} onEditCategoryIcon={editCategoryIcon} />
    <VersionFooter T={T}/></div></div>;

  if(view==="profile") return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={INNER}><ProfileScreen member={profileTarget} members={members} offers={offers}
      transactions={transactions} balances={balances} invites={invites} meId={meId} T={T}
      categories={categories}
      onBack={goBack} onAddOffer={addOffer} onEditOffer={editOffer}
      onToggleOffer={toggleOffer} onDeleteOffer={deleteOffer}
      onUpdateProfile={updateProfile} onCreateInvite={createInvite}
      onCancelTx={cancelTx} onConfirmTx={confirmTx} onMarkDone={markDone} onSelectMember={goToMember}
      reviews={reviews} onReview={setShowReviewFor} />
    <VersionFooter T={T}/></div></div>;

  return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={INNER}>
    {/* HEADER */}
    <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.bg,zIndex:50}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,color:T.text4,letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>🌾 Общий фонд</div>
          <div style={{fontSize:19,fontWeight:700,letterSpacing:"-0.5px",color:T.text}}>{members.length} участников</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
          <div>
            <Pill T={T} balance={myBalance} />
            {myBalance>DEMURRAGE_THRESHOLD&&<div style={{fontSize:10,color:"#fb923c",textAlign:"center",marginTop:1}}>
              -{cur(calcDemurrage(myBalance,1))}/мес
            </div>}
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {/* единый стиль для всех кнопок шапки */}
            {[
              { icon: themeKey==="dark"?"☀️":"🌙", onClick:()=>setThemeKey(k=>k==="dark"?"light":"dark"), badge:0 },
              { icon:"💬", onClick:()=>setView("chat"), badge: messages.filter(m=>m.to===meId&&!m.read).length },
              { icon:"✓", onClick:()=>setView("tasks"), badge: transactions.filter(t=>(t.from===meId||t.to===meId)&&t.status==="active").length, iconStyle:{fontWeight:700,fontSize:15} },
              { icon:"🔔", onClick:()=>setShowNotifs(!showNotifs), badge: myNotifs.length },
            ].map((b,i)=>(
              <button key={i} onClick={b.onClick} style={{
                position:"relative",width:32,height:32,borderRadius:8,
                background:T.card,border:`1px solid ${T.border}`,
                color:T.text2,fontSize:16,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                flexShrink:0,...(b.iconStyle||{})
              }}>
                {b.icon}
                {b.badge>0&&<span style={{position:"absolute",top:-4,right:-4,minWidth:15,height:15,borderRadius:8,background:"#f97316",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px"}}>{b.badge}</span>}
              </button>
            ))}
            {canModerate(myRole)&&<button onClick={()=>setView("admin")} style={{
              width:32,height:32,borderRadius:8,background:"#fbbf2415",
              border:"1px solid #fbbf2430",color:"#fbbf24",fontSize:15,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
            }}>⚙️</button>}
            <button onClick={handleLogout} style={{
              height:32,borderRadius:8,background:T.card,
              border:`1px solid ${T.border}`,color:T.text4,
              padding:"0 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",flexShrink:0
            }}>Выйти</button>
          </div>
        </div>
      </div>
      <div onClick={()=>{setProfileTarget(me);setView("profile");}}
        style={{marginTop:10,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 13px",display:"flex",alignItems:"center",gap:11,cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.background=T.border}
        onMouseLeave={e=>e.currentTarget.style.background=T.card}>
        <Avatar member={me} size={34} />
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:T.text}}>{me.name}</div>
          <div style={{fontSize:11,color:T.accent,marginTop:1}}>Мой профиль →</div></div>
        <button onClick={e=>{e.stopPropagation();setShowGift(true);}} style={{background:T.border,border:"none",color:T.text2,padding:"5px 11px",borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>💛</button>
      </div>
    </div>

    {/* NOTIFICATIONS DROPDOWN */}
    {showNotifs&&<div style={{position:"sticky",top:118,background:T.card,border:`1px solid ${T.border}`,
      borderRadius:0,borderLeft:"none",borderRight:"none",zIndex:45,maxHeight:260,overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",
        borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.card,zIndex:1}}>
        <span style={{fontSize:11,color:T.text4,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Уведомления</span>
        <div style={{display:"flex",gap:6}}>
          {notifications.filter(n=>n.memberId===meId&&!n.read).length>0&&
            <button onClick={async()=>{
              const ids=notifications.filter(n=>n.memberId===meId&&!n.read).map(n=>n.id);
              setNotifications(p=>p.map(x=>x.memberId===meId?{...x,read:true}:x));
              for(const id of ids) await sb.update("notifications",{id},{read:true});
            }}
              style={{fontSize:11,background:"none",border:`1px solid ${T.border}`,color:T.text4,
                padding:"2px 8px",borderRadius:6,cursor:"pointer",fontFamily:"inherit"}}>Прочитать все</button>}
          {notifications.filter(n=>n.memberId===meId).length>0&&
            <button onClick={async()=>{
              const ids=notifications.filter(n=>n.memberId===meId).map(n=>n.id);
              setNotifications(p=>p.filter(x=>x.memberId!==meId));
              for(const id of ids) await sb.delete("notifications",{id});
              setShowNotifs(false);
            }}
              style={{fontSize:11,background:"none",border:`1px solid #7f1d1d`,color:"#f87171",
                padding:"2px 8px",borderRadius:6,cursor:"pointer",fontFamily:"inherit"}}>Очистить</button>}
        </div>
      </div>
      {notifications.filter(n=>n.memberId===meId).length===0
        ?<div style={{padding:"16px 20px",fontSize:13,color:T.text5}}>Нет уведомлений</div>
        :notifications.filter(n=>n.memberId===meId).slice(0,15).map(n=>(
          <div key={n.id} onClick={async()=>{
              if(!n.read){ setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x)); await sb.update("notifications",{id:n.id},{read:true}); }
            }}
            style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",
              background:n.read?"transparent":"#6366f108",display:"flex",gap:10,alignItems:"flex-start"}}
            onMouseEnter={e=>e.currentTarget.style.background=T.border}
            onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"#6366f108"}>
            <span style={{fontSize:16,opacity:n.read?0.5:1}}>{n.type==="gift"?"💛":n.type==="booking"?"📦":n.type==="bid"?"💬":n.type==="accepted"?"✅":"🔔"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:n.read?T.text3:T.text,lineHeight:1.4}}>{n.text}</div>
              <div style={{fontSize:10,color:T.text5,marginTop:2,fontFamily:"monospace"}}>{n.date}</div>
            </div>
            {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:"#f97316",flexShrink:0,marginTop:4}} />}
          </div>
        ))}
    </div>}

    {/* SEARCH */}
    <div style={{padding:"9px 20px 0",position:"sticky",top:118,background:T.bg,zIndex:40}}>
      <div style={{position:"relative"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию, категории…"
          style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,borderRadius:10,
            color:T.text,padding:"9px 14px 9px 32px",fontSize:13,fontFamily:"inherit",outline:"none"}} />
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.text5,fontSize:13}}>🔍</span>
        {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:9,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:T.text4,cursor:"pointer",fontSize:15}}>×</button>}
      </div>
    </div>

    {/* TABS */}
    <div style={{display:"flex",padding:"0 20px",borderBottom:`1px solid ${T.border}`,position:"sticky",top:157,background:T.bg,zIndex:39,marginTop:8,overflowX:"auto"}}>
      {TABS_DEF.map(t=>{
        const badge=t.key==="requests"?requests.filter(r=>r.status==="open").length
          :t.key==="news"?pinnedNews.length:0;
        return <button key={t.key} onClick={()=>changeTab(t.key, tabKeys.indexOf(t.key) > tabIdx ? "left" : "right")} style={{
          background:"none",border:"none",padding:"10px 0",marginRight:16,fontSize:12,
          fontWeight:tab===t.key?600:400,color:tab===t.key?T.text:T.text4,
          borderBottom:tab===t.key?`2px solid ${T.accent}`:"2px solid transparent",
          cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",position:"relative"}}>
          {t.l}
          {badge>0&&<span style={{marginLeft:4,fontSize:10,background:"#6366f130",color:"#818cf8",padding:"0 5px",borderRadius:8}}>{badge}</span>}
        </button>;
      })}
    </div>

    {/* PTR Indicator */}
    <div style={{
      overflow:"hidden",
      height: ptrPull,
      transition: ptrDone ? "none" : (ptrPull===0 ? "height 0.3s ease" : "none"),
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:8,
        opacity: Math.min(ptrPull / PTR_THRESHOLD, 1),
        transform: `rotate(${ptrDone ? 720 : (ptrPull/PTR_THRESHOLD)*180}deg)`,
        transition: ptrDone ? "transform 0.5s ease" : "none",
        fontSize:20, color: T.accent,
      }}>
        {ptrDone ? "✓" : "↓"}
      </div>
      <span style={{
        fontSize:12, color:T.text4, marginLeft:6,
        opacity: Math.min(ptrPull / PTR_THRESHOLD, 1),
      }}>{ptrDone ? "Обновляем…" : (ptrPull >= PTR_THRESHOLD ? "Отпустите" : "Потяните вниз")}</span>
    </div>

    <div ref={scrollRef}
      onTouchStart={ptrTouchStart} onTouchMove={ptrTouchMove} onTouchEnd={ptrTouchEnd}
      style={{padding:"12px 20px",paddingBottom:80}} {...swipeMain}>

      <div key={tabKey} className={tabDir==="left"?"tab-enter-left":tabDir==="right"?"tab-enter-right":""}>

      {/* CAT FILTER */}
      {(tab==="offers"||tab==="requests")&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {(categories||CATEGORIES).map(c=><button key={c} onClick={()=>setCatFilter(c)} style={{
          background:catFilter===c?T.accent:T.card,border:`1px solid ${catFilter===c?T.accent:T.border}`,
          color:catFilter===c?"#fff":T.text2,padding:"4px 11px",borderRadius:20,fontSize:12,
          fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{CAT_ICONS[c]} {c}</button>)}
      </div>}

      {/* NEWS TAB */}
      {tab==="news"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <div onClick={()=>setShowConstitution(true)} style={{display:"flex",alignItems:"center",gap:10,
          background:"#6366f115",border:"1px solid #6366f130",borderRadius:13,padding:"12px 15px",
          marginBottom:12,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="#6366f120"}
          onMouseLeave={e=>e.currentTarget.style.background="#6366f115"}>
          <div style={{fontSize:22}}>📜</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14,color:"#818cf8"}}>Правила Общего фонда</div>
            <div style={{fontSize:11,color:T.text4,marginTop:1}}>Как работает система · Демередж · Роли</div>
          </div>
          <div style={{color:"#6366f1",fontSize:14}}>→</div>
        </div>
        {allNews.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"32px 0",fontSize:13}}>Новостей пока нет</div>}
        {allNews.map(n=>{const author=findM(members,n.author);return (
          <div key={n.id} style={{background:T.card,border:`1px solid ${n.pinned?"#6366f140":T.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
            {n.pinned&&<div style={{fontSize:10,color:"#6366f1",marginBottom:5}}>📌 Закреплено</div>}
            <div style={{fontWeight:700,fontSize:15,marginBottom:6,color:T.text}}>{n.title}</div>
            <div style={{fontSize:13,color:T.text2,lineHeight:1.6,marginBottom:10}}>{n.body}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Avatar member={author} size={20} />
              <span style={{fontSize:11,color:T.text4}}>{author.name.split(" ")[0]}</span>
              <span style={{fontSize:11,color:T.text5,marginLeft:"auto",fontFamily:"monospace"}}>{n.date}</span>
            </div>
          </div>
        );})}
      </div>}

      {/* OFFERS */}
      {tab==="offers"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <button onClick={()=>setAddingOff(true)}
          style={{width:"100%",background:T.card,border:`1px dashed ${T.border2}`,borderRadius:14,padding:"11px",
            color:T.accent,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:11}}>
          ✦ Опубликовать предложение
        </button>
        {filtOffers.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"32px 0",fontSize:13}}>{search?"Ничего не найдено":"Нет предложений"}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {filtOffers.map(offer=>{const owner=findM(members,offer.member);
            return <div key={offer.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",cursor:"pointer",display:"flex",gap:12,overflow:"hidden"}}
              onClick={()=>{setSelOffer(offer);setBookQty(1);}}
              onMouseEnter={e=>e.currentTarget.style.background=T.border}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              {offer.photo
                ? <div onClick={e=>{e.stopPropagation();setLightbox(offer.photo);}} style={{width:54,height:54,borderRadius:10,overflow:"hidden",flexShrink:0,cursor:"zoom-in"}}><img src={offer.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
                : <div style={{width:42,height:42,borderRadius:10,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{CAT_ICONS[offer.category]}</div>}
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14,marginBottom:3,color:T.text}}>{offer.title}</div>
                <div style={{fontSize:12,color:T.text3,lineHeight:1.4}}>{offer.desc}</div>
                <div style={{marginTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div onClick={e=>{e.stopPropagation();setProfileTarget(owner);setView("profile");}} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
                    <Avatar member={owner} size={18} />
                    <span style={{fontSize:11,color:T.accent}}>{owner.name.split(" ")[0]}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:offer.price===0?"#4ade80":T.text}}>{offer.price===0?"бесплатно":`${cur(offer.price)}/${offer.unit}`}</span>
                </div>
                <QtyBar T={T} qty={offer.qty} reserved={offer.reserved} />
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* REQUESTS */}
      {tab==="requests"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <button onClick={()=>setAddingReq(true)} style={{width:"100%",background:T.card,border:`1px dashed ${T.border2}`,borderRadius:14,padding:"11px",color:T.accent,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:11}}>🙋 Опубликовать запрос</button>
        {filtReqs.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"28px 0",fontSize:13}}>{search?"Ничего":"Запросов пока нет"}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {filtReqs.map(req=>{const author=findM(members,req.member),isMyReq=req.member===meId;
            const pendBids=req.bids.filter(b=>b.status==="pending").length;
            const myBid=req.bids.find(b=>b.from===meId);
            const reqTx=transactions.find(t=>t.reqId===req.id&&(t.status==="active"||t.status==="awaiting_confirm"));
            const canAcceptWork=isMyReq&&reqTx?.status==="awaiting_confirm";
            return <div key={req.id} style={{background:T.card,border:`1px solid ${canAcceptWork?"#4ade8040":req.status==="closed"?"#4ade8030":isMyReq?"#6366f130":T.border}`,borderRadius:14,padding:"13px 14px",cursor:"pointer"}}
              onClick={()=>setOpenReq(req)}
              onMouseEnter={e=>e.currentTarget.style.background=T.border}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              <div style={{display:"flex",gap:11}}>
                <div style={{width:40,height:40,borderRadius:10,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{CAT_ICONS[req.category]||"🙋"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{fontWeight:600,fontSize:14,color:T.text}}>{req.title}</div>
                    {req.status==="closed"?<span style={{fontSize:11,color:"#4ade80",marginLeft:8,flexShrink:0}}>✓</span>
                      :isMyReq&&pendBids>0?<span style={{fontSize:11,background:"#f9713015",color:"#f97316",padding:"1px 7px",borderRadius:6,marginLeft:8,flexShrink:0}}>{pendBids} предл.</span>:null}
                  </div>
                  <div style={{fontSize:12,color:T.text3,lineHeight:1.4}}>{req.desc}</div>
                  <div style={{marginTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <Avatar member={author} size={16} />
                      <span style={{fontSize:11,color:T.accent}}>{author.name.split(" ")[0]}</span>
                    </div>
                    {canAcceptWork&&<button onClick={e=>{e.stopPropagation();confirmTx(reqTx.id);}}
                      style={{background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"4px 10px",
                        borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                      ✓ Принять работу
                    </button>}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {req.budget&&<span style={{fontSize:11,color:"#fbbf24"}}>до {cur(req.budget)}</span>}
                      {myBid&&myBid.status==="pending"&&<span style={{fontSize:11,color:T.text2}}>вы: {cur(myBid.price)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* MEMBERS */}
      {tab==="members"&&<div style={{display:"flex",flexDirection:"column",gap:9,animation:"fadeUp 0.3s ease"}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:13,padding:"11px 14px",marginBottom:4}}>
          <div style={{fontSize:11,color:T.text4,marginBottom:4}}>Сумма всех балансов = {cur(Object.values(balances).reduce((a,b)=>a+b,0))}</div>
          <div style={{height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:2,background:"linear-gradient(90deg,#6366f1,#22c55e)",width:"100%"}} /></div>
          <div style={{fontSize:11,color:T.text5,marginTop:4}}>Взаимный кредит · {CUR.plural} созданы из доверия</div>
        </div>
        {members.map(m=>{
          const bal=balances[m.id]??m.balance;
          const pot=payPotential(m.id,offers,bal);
          return <div key={m.id} onClick={()=>{setProfileTarget(m);setView("profile");}}
            style={{background:T.card,border:`1px solid ${m.id===meId?"#6366f130":m.frozen?"#33455360":T.border}`,
              borderRadius:13,padding:"11px 14px",display:"flex",alignItems:"center",gap:13,cursor:"pointer",opacity:m.frozen?0.6:1}}
            onMouseEnter={e=>e.currentTarget.style.background=T.border}
            onMouseLeave={e=>e.currentTarget.style.background=T.card}>
            <Avatar member={m} size={42} />
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <span style={{fontWeight:600,fontSize:14,color:T.text}}>{m.name}</span>
                {m.id===meId&&<span style={{fontSize:11,background:"#6366f120",color:"#818cf8",padding:"2px 7px",borderRadius:10}}>вы</span>}
                <RoleBadge role={m.systemRole} />
                {m.frozen&&<span style={{fontSize:10,color:T.text3}}>❄</span>}
              </div>
              <div style={{fontSize:11,color:T.text4,marginTop:2}}>{m.profession||(m.skills||[]).join(" · ")}</div>
              {pot!==bal&&<div style={{fontSize:10,color:T.text5,marginTop:1}}>потенциал: {cur(pot)}</div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <Pill T={T} balance={bal} />
              <span style={{color:T.text5}}>›</span>
            </div>
          </div>;})}
      </div>}

      {/* GRAPH */}
      {tab==="graph"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <div style={{fontSize:13,color:T.text4,marginBottom:10}}>Нажми на участника → открыть профиль</div>
        <NetworkGraph members={members} transactions={transactions} invites={invites} onSelectMember={goToMember} />
      </div>}

      {/* LEDGER */}
      {tab==="ledger"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <div style={{fontSize:11,color:T.text4,marginBottom:10}}>Все транзакции публичны · {transactions.length} записей</div>
        {transactions.length===0&&<div style={{textAlign:"center",color:T.text5,padding:"32px 0",fontSize:13}}>Транзакций пока нет</div>}
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[...transactions].sort((a,b)=>b.id-a.id).map(tx=>{const from=findM(members,tx.from),to=findM(members,tx.to);
            const isGift=tx.type==="gift",sc=S_COLOR[tx.status]||"#475569";
            return <div key={tx.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",opacity:tx.status==="cancelled"?0.35:1}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:4}}><span>{isGift?"💛":"⇄"}</span><span style={{fontSize:13,fontWeight:500,color:T.text}}>{tx.what}</span></div>
                  <div style={{fontSize:11,color:T.text4,display:"flex",gap:5,alignItems:"center"}}>
                    <span onClick={()=>from.id&&goToMember(from.id)} style={{cursor:from.id?"pointer":"default",color:from.id?T.accent:T.text4}}>{from.name.split(" ")[0]}</span>
                    <span>→</span>
                    <span onClick={()=>to.id&&goToMember(to.id)} style={{cursor:to.id?"pointer":"default",color:to.id?T.accent:T.text4}}>{to.name.split(" ")[0]}</span>
                    <span style={{background:`${sc}18`,color:sc,padding:"1px 5px",borderRadius:5,fontSize:10}}>{S_LABEL[tx.status]||tx.status}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",marginLeft:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:isGift?"#fbbf24":T.text}}>{cur(tx.amount)}</div>
                  <div style={{fontSize:10,color:T.text5,fontFamily:"monospace"}}>{tx.date}</div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}
    </div>

    {/* FOOTER */}
    <div style={{margin:"32px 20px 0",padding:"20px",background:T.card,border:`1px solid ${T.border}`,
      borderRadius:20,textAlign:"center"}}>
      <div style={{fontSize:22,marginBottom:6}}>🌾</div>
      <div style={{fontWeight:700,fontSize:15,color:T.text,marginBottom:4}}>Общий фонд</div>
      <div style={{fontSize:12,color:T.text4,lineHeight:1.6,marginBottom:14}}>
        Сообщество взаимопомощи на основе доверия.<br/>
        Внутренняя валюта · Прозрачные сделки · Без посредников
      </div>
      <button onClick={()=>setShowConstitution(true)}
        style={{display:"inline-flex",alignItems:"center",gap:7,background:"#6366f115",
          border:"1px solid #6366f130",borderRadius:10,padding:"9px 16px",
          color:"#818cf8",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
        📜 Правила Общего фонда
      </button>
      <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`,
        display:"flex",justifyContent:"center",gap:20}}>
        <button onClick={()=>setView("chat")} style={{background:"none",border:"none",color:T.text4,
          fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>💬 Чат</button>
        <button onClick={()=>setView("tasks")} style={{background:"none",border:"none",color:T.text4,
          fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>📋 Задачи</button>
        <button onClick={()=>setShowGift(true)} style={{background:"none",border:"none",color:T.text4,
          fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>💛 Подарить</button>
      </div>
      <div style={{marginTop:12,fontSize:10,color:T.text5,fontFamily:"monospace"}}>
        v{APP_VERSION} · {new Date().getFullYear()}
      </div>
    </div>{/* end tab animation wrapper */}
    </div>{/* end scroll container */}

    {/* BOOK SHEET */}
    {selOffer&&<Sheet T={T} onClose={()=>{setSelOffer(null);setTxNote("");setBookQty(1);}}>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        {selOffer.photo
          ? <div style={{width:54,height:54,borderRadius:12,overflow:"hidden",flexShrink:0}}><img src={selOffer.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
          : <div style={{width:48,height:48,borderRadius:12,background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{CAT_ICONS[selOffer.category]}</div>}
        <div><div style={{fontWeight:700,fontSize:16,color:T.text}}>{selOffer.title}</div><div style={{fontSize:13,color:T.text3,marginTop:3}}>{selOffer.desc}</div></div>
      </div>
      <QtyBar T={T} qty={selOffer.qty} reserved={selOffer.reserved} />
      <div style={{marginTop:13}}>
        <SL T={T}>Количество</SL>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <button onClick={()=>setBookQty(q=>Math.max(1,q-1))} style={{width:36,height:36,borderRadius:8,background:T.border,border:"none",color:T.text,fontSize:20,cursor:"pointer"}}>−</button>
          <span style={{fontSize:20,fontWeight:700,minWidth:26,textAlign:"center",color:T.text}}>{bookQty}</span>
          <button onClick={()=>setBookQty(q=>Math.min(selOffer.qty-selOffer.reserved,q+1))} style={{width:36,height:36,borderRadius:8,background:T.border,border:"none",color:T.text,fontSize:20,cursor:"pointer"}}>+</button>
          <span style={{fontSize:12,color:T.text3}}>доступно: {selOffer.qty-selOffer.reserved}</span>
        </div>
      </div>
      {selOffer.price>0?<>
        <IRow T={T} label={`Итого ×${bookQty}`}><span style={{fontWeight:700,fontSize:17,color:T.text}}>{cur(selOffer.price*bookQty)}</span></IRow>
        <IRow T={T} label="Баланс после"><Pill T={T} balance={myBalance-selOffer.price*bookQty} /></IRow>
      </>:<IRow T={T} label="Стоимость"><span style={{color:"#4ade80",fontWeight:600}}>бесплатно</span></IRow>}
      <FI T={T} value={txNote} onChange={setTxNote} placeholder="Сообщение…" multi />
      <PB T={T} onClick={doBook} disabled={(selOffer.qty-selOffer.reserved)<bookQty||selOffer.member===meId}>
          {selOffer.member===meId?"Это ваше предложение":`Забронировать${bookQty>1?` ×${bookQty}`:""}`}
        </PB>
    </Sheet>}

    {/* GIFT SHEET */}
    {showGift&&<Sheet T={T} onClose={()=>{setShowGift(false);setGiftCustom("");}}>
      <div style={{fontSize:18,fontWeight:700,marginBottom:4,color:T.text}}>💛 Передать дар</div>
      <div style={{fontSize:13,color:T.text4,marginBottom:14}}>Дар не создаёт обязательств</div>
      <SL T={T}>Кому</SL>
      <GiftMemberPicker members={members} meId={meId} giftTo={giftTo} setGiftTo={setGiftTo} balances={balances} T={T} />
      <SL T={T}>Размер</SL>
      <div style={{display:"flex",gap:7,marginBottom:9}}>
        {[5,10,20,50].map(n=><button key={n} onClick={()=>{setGiftAmt(n);setGiftCustom("");}} style={{flex:1,
          background:giftAmt===n&&!giftCustom?T.accent:T.input,
          border:`1px solid ${giftAmt===n&&!giftCustom?T.accent:T.border}`,
          color:giftAmt===n&&!giftCustom?"#fff":T.text2,
          padding:"7px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>)}
      </div>
      <input type="number" min="1" value={giftCustom} onChange={e=>{setGiftCustom(e.target.value);setGiftAmt(0);}}
        placeholder="Или введи свою сумму…"
        style={{width:"100%",background:T.input,border:`1px solid ${giftCustom?T.accent:T.border}`,borderRadius:10,
          color:T.text,padding:"10px 14px",fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:11}} />
      <FI T={T} value={giftMsg} onChange={setGiftMsg} placeholder="Слово дара…" multi s={{height:60}} />
      <PB T={T} v="gold" onClick={doGift} disabled={!giftTo}>Передать {cur(giftCustom?Number(giftCustom):giftAmt)} · без условий</PB>
    </Sheet>}

    {addingReq&&<RequestForm T={T} categories={categories} onClose={()=>setAddingReq(false)} onSave={d=>{addRequest(d);setAddingReq(false);}} />}
    {addingOff&&<OfferForm T={T} categories={categories} onClose={()=>setAddingOff(false)} onSave={d=>{addOffer(d);setAddingOff(false);}} />}
    {openReq&&<RequestDetail T={T} request={openReq} members={members} meId={meId}
      onAcceptBid={(rId,bId)=>{acceptBid(rId,bId);setOpenReq(null);}}
      onDeclineBid={declineBid}
      onBid={(rId,p,n)=>{addBid(rId,p,n);setOpenReq(requests.find(r=>r.id===rId)||openReq);}}
      onClose={()=>setOpenReq(null)} />}
    {lightbox&&<Lightbox src={lightbox} onClose={()=>setLightbox(null)} />}
    {showReviewFor&&<ReviewForm T={T} tx={showReviewFor} members={members} meId={meId}
      onSave={d=>{addReview(d);setShowReviewFor(null);}}
      onClose={()=>setShowReviewFor(null)} />}
    </div>
  </div>;
}
