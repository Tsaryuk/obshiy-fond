import { useState, useRef, useEffect, useCallback } from "react";
import sb from "./lib/supabase";
import { CUR, cur, ROLES, ROLE_LABEL, canModerate, CATEGORIES, CAT_ICONS, THEMES, APP_VERSION, S_LABEL, S_COLOR, DEMURRAGE_THRESHOLD, DEFAULT_NEG_LIMIT } from "./lib/constants";
import { toMember, toOffer, toRequest, toTx, toReview, toMsg, toNotif, toInvite } from "./lib/converters";
import { uid, findM, genCode, today, initBalances, matchSearch, calcDemurrage, payPotential } from "./lib/utils";
import { GCSS } from "./lib/styles";
import useSwipe from "./hooks/useSwipe";
import { Avatar, Pill, RoleBadge, QtyBar, Sheet, SL, IRow, FI, PB, Notif, VersionFooter } from "./components/ui";
import AuthScreen from "./components/AuthScreen";
import AdminPanel from "./components/AdminPanel";
import ChatScreen from "./components/ChatScreen";
import ProfileScreen from "./components/ProfileScreen";
import MyTasksScreen from "./components/MyTasksScreen";
import DealsScreen from "./components/DealsScreen";
import ConstitutionScreen from "./components/ConstitutionScreen";
import NetworkGraph from "./components/NetworkGraph";
import Lightbox from "./components/Lightbox";
import OfferForm from "./components/forms/OfferForm";
import RequestForm from "./components/forms/RequestForm";
import RequestDetail from "./components/forms/RequestDetail";
import ReviewForm from "./components/forms/ReviewForm";
import GiftMemberPicker from "./components/forms/GiftMemberPicker";
import NotificationSettings from "./components/NotificationSettings";
export default function App() {
  const [meId,         setMeId]         = useState(null);
  const [themeKey, setThemeKey] = useState(()=>{
    try { return localStorage.getItem("of_theme")||"dark"; } catch(e){ return "dark"; }
  });
  const T = THEMES[themeKey] || THEMES.dark;
  useEffect(()=>{
    try { localStorage.setItem("of_theme", themeKey); } catch(e){}
    document.documentElement.setAttribute("data-theme", themeKey);
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
  const [chatInitPeer, setChatInitPeer] = useState(null); // pre-open chat with member
  const [chatInitMsg,  setChatInitMsg]  = useState("");   // pre-fill message
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
  const tabsRef = useRef(null);

  // Scroll active tab into view
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeBtn = container.children[tabIdx];
    if (!activeBtn) return;
    const left = activeBtn.offsetLeft - container.offsetLeft - 16;
    container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [tab, tabIdx]);

  // Pull-to-refresh state
  const scrollRef = useRef(null);
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

  // ── open chat with pre-filled message ──
  function openChatWith(peerId, prefillMsg=""){
    setChatInitPeer(peerId);
    setChatInitMsg(prefillMsg);
    setView("chat");
  }

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

  // ── disputes ──
  async function openDispute(txId, reason){
    const tx=transactions.find(t=>t.id===txId);if(!tx)return;
    const otherId=tx.from===meId?tx.to:tx.from;
    // Notify moderators
    members.filter(m=>m.systemRole==="admin"||m.systemRole==="moderator").forEach(mod=>{
      addNotification(mod.id,"dispute",`Спор по сделке «${tx.what}»: ${reason}`);
    });
    addNotification(otherId,"dispute",`${me.name} открыл спор по сделке «${tx.what}»`);
    notify("⚖️ Спор отправлен модераторам");
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
  async function sendMessage(from, to, text, attachment) {
    if(text===null && !attachment) { // mark-read call
      const unread=messages.filter(m=>m.to===meId&&m.from===to&&!m.read);
      setMessages(p=>p.map(m=>m.to===meId&&m.from===to?{...m,read:true}:m));
      for(const msg of unread) sb.update("messages",{id:msg.id},{read:true});
      return;
    }
    const now = new Date();
    const time = now.toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"});
    const id=uid();
    const isGroup=(to==="group");

    // Upload attachment if present
    let attachmentUrl = null;
    let attachmentName = null;
    if(attachment) {
      const ext = attachment.name.split(".").pop();
      const path = `chat/${id}.${ext}`;
      attachmentUrl = await sb.upload("chat-files", path, attachment);
      attachmentName = attachment.name;
    }

    const row = {id,from_member:from,to_member:isGroup?"group":to,
      body:text||"",date:time,is_group:isGroup,created_ts:now.getTime()};
    if(attachmentUrl) { row.attachment = attachmentUrl; row.attachment_name = attachmentName; }

    await sb.insert("messages",row);
    const msg = {id,from,text:text||"",time,ts:now.getTime(),read:false,edited:false,deleted:false,
      attachment:attachmentUrl,attachmentName};

    if(isGroup) {
      setGroupMessages(p=>[...p,msg]);
    } else {
      setMessages(p=>[...p,{...msg,to}]);
      addNotification(to,"chat",`${me.name}: ${(text||attachmentName||"").slice(0,40)}`);
    }

    // Notify @mentioned members
    if(text) {
      const mentionRegex = /@(\S+)/g;
      let match;
      while((match=mentionRegex.exec(text))!==null) {
        const mentionName = match[1].toLowerCase();
        const mentioned = members.find(m=>m.id!==from && m.name.toLowerCase().startsWith(mentionName));
        if(mentioned && mentioned.id!==to) {
          addNotification(mentioned.id,"mention",`${me.name} упомянул вас в чате`);
        }
      }
    }
  }

  async function editMessage(msgId, newText, isGroup) {
    await sb.update("messages",{id:msgId},{body:newText,edited:true});
    const setter = isGroup ? setGroupMessages : setMessages;
    setter(p=>p.map(m=>m.id===msgId?{...m,text:newText,edited:true}:m));
  }

  async function deleteMessage(msgId, isGroup) {
    await sb.update("messages",{id:msgId},{deleted:true,body:""});
    const setter = isGroup ? setGroupMessages : setMessages;
    setter(p=>p.map(m=>m.id===msgId?{...m,text:"",deleted:true}:m));
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
    <div className="flex-col items-center justify-center" style={{minHeight:"100vh",gap:16}}>
      <div style={{fontSize:48}}>🌾</div>
      <div style={{fontSize:"var(--text-xl)",fontWeight:700}}>Общий фонд</div>
      {dbError
        ? <div style={{color:"var(--color-danger)",fontSize:"var(--text-sm)",textAlign:"center",maxWidth:280,lineHeight:1.5}}>{dbError}<br/><br/>
            <span style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)"}}>Проверь ключи Supabase в коде (SUPA_URL, SUPA_KEY)</span></div>
        : <div style={{color:"var(--color-text-muted)",fontSize:"var(--text-sm)"}}>Загрузка данных…</div>
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

  const WRAP={minHeight:"100dvh"};
  const INNER={maxWidth:520,margin:"0 auto",position:"relative"};

  // ─── BOTTOM TAB BAR ──
  const TAB_BAR_ITEMS = [
    {key:"main", icon:"🏠", iconActive:"🏠", label:"Главная"},
    {key:"chat", icon:"💬", iconActive:"💬", label:"Чат"},
    {key:"tasks", icon:"📋", iconActive:"📋", label:"Сделки"},
    {key:"profile", icon:"👤", iconActive:"👤", label:"Профиль"},
  ];
  const BottomTabBar = () => (
    <nav className="tab-bar">
      {TAB_BAR_ITEMS.map(item=>{
        const isActive = item.key==="main" ? view==="main" : view===item.key;
        const unread = item.key==="chat" ? messages.filter(m=>m.to===meId&&!m.read).length
          : item.key==="tasks" ? transactions.filter(t=>(t.from===meId||t.to===meId)&&t.status==="active").length
          : 0;
        return <button key={item.key} className={`tab-item ${isActive?"tab-item-active":""}`}
          onClick={()=>{
            if(item.key==="main"){setView_("main");setViewStack([]);}
            else if(item.key==="profile"){setProfileTarget(me);setView("profile");}
            else setView(item.key);
          }}>
          <span className="tab-item-icon">{isActive?item.iconActive:item.icon}</span>
          <span>{item.label}</span>
          {unread>0&&<span className="tab-item-dot" />}
        </button>;
      })}
      {canModerate(myRole)&&<button className={`tab-item ${view==="admin"?"tab-item-active":""}`}
        onClick={()=>setView("admin")}>
        <span className="tab-item-icon">⚙️</span>
        <span>Админ</span>
      </button>}
    </nav>
  );

  if(showConstitution) return <div style={WRAP}><style>{GCSS}</style>
    <div style={INNER}><ConstitutionScreen T={T} onBack={()=>setShowConstitution(false)}/></div></div>;

  if(view==="chat") return <div style={WRAP}><style>{GCSS}</style>{notif&&<Notif msg={notif}/>}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}><ChatScreen meId={meId} members={members} messages={messages}
      onSend={sendMessage} onEdit={editMessage} onDelete={deleteMessage}
      onBack={()=>{setChatInitPeer(null);setChatInitMsg("");goBack();}} groupMessages={groupMessages} T={T} onSelectMember={goToMember}
      initialPeerId={chatInitPeer} initialMsg={chatInitMsg}/>
    <VersionFooter/></div><BottomTabBar /></div>;

  if(view==="tasks") return <div style={WRAP}><style>{GCSS}</style>{notif&&<Notif msg={notif}/>}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}><DealsScreen meId={meId} members={members} transactions={transactions}
      requests={requests} T={T} onBack={goBack}
      onConfirmTx={confirmTx} onCancelTx={cancelTx} onMarkDone={markDone} onCancelRequest={cancelRequest} onCancelBid={cancelBid} onSelectMember={goToMember} onOpenReq={(r)=>{setOpenReq(r);setView("main");}} reviews={reviews} onReview={setShowReviewFor} onOpenDispute={openDispute}/>
    <VersionFooter/></div><BottomTabBar /></div>;

  if(view==="admin") return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}><AdminPanel members={members} offers={offers} transactions={transactions}
      invites={invites} balances={balances} news={news} meId={meId} T={T}
      onCreateInvite={createInvite} onBack={goBack}
      onSelectMember={goToMember} onFreezeToggle={freezeToggle}
      onDeleteMember={deleteMember} onSetRole={setRole}
      onAddNews={addNews} onDeleteNews={deleteNews} negLimit={negLimit} onSetNegLimit={async (v)=>{
              await sb.upsert("settings",{key:"neg_limit",value:String(v)},"key");
              setNegLimit(v);
            }}
      categories={categories} onAddCategory={addCategory} onDeleteCategory={deleteCategory} onMoveCategory={moveCategory} onEditCategoryIcon={editCategoryIcon} />
    <VersionFooter/></div><BottomTabBar /></div>;

  if(view==="profile") return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}><ProfileScreen member={profileTarget} members={members} offers={offers}
      transactions={transactions} balances={balances} invites={invites} meId={meId} T={T}
      categories={categories}
      onBack={goBack} onAddOffer={addOffer} onEditOffer={editOffer}
      onToggleOffer={toggleOffer} onDeleteOffer={deleteOffer}
      onUpdateProfile={updateProfile} onCreateInvite={createInvite}
      onCancelTx={cancelTx} onConfirmTx={confirmTx} onMarkDone={markDone} onSelectMember={goToMember}
      reviews={reviews} onReview={setShowReviewFor}
      onOpenNotifSettings={()=>setView("notifSettings")} />
    <VersionFooter/></div><BottomTabBar /></div>;

  if(view==="notifSettings") return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}>
      <NotificationSettings meId={meId} T={T} onBack={goBack} notify={notify} />
    <VersionFooter/></div><BottomTabBar /></div>;

  return <div style={WRAP}><style>{GCSS}</style>
    {notif&&<Notif msg={notif} />}
    <div style={{...INNER,paddingBottom:"calc(var(--nav-height) + var(--safe-area-bottom) + 8px)"}}>
    {/* STICKY TOP: HEADER + SEARCH + TABS */}
    <div className="header" style={{padding:0,flexDirection:"column",gap:0,borderBottom:"none"}}>
      <div style={{padding:"14px 20px 10px",borderBottom:"1px solid var(--color-border)",display:"flex",flexDirection:"column",gap:0}}>
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            <div style={{fontSize:28,lineHeight:1}}>🌾</div>
            <div>
              <div style={{fontSize:"var(--text-xl)",fontWeight:700,letterSpacing:"var(--tracking-tight)",lineHeight:1.2}}>Общий фонд</div>
              <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginTop:1}}>{members.length} участников</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill balance={myBalance} />
            <div className="flex items-center gap-1">
              <button className="btn-icon" onClick={()=>setThemeKey(k=>k==="dark"?"light":"dark")}
                style={{width:34,height:34,borderRadius:"var(--radius-md)"}}>{themeKey==="dark"?"☀️":"🌙"}</button>
              <button className="btn-icon" onClick={()=>setShowNotifs(!showNotifs)}
                style={{width:34,height:34,borderRadius:"var(--radius-md)",position:"relative"}}>🔔
                {myNotifs.length>0&&<span className="conv-unread" style={{top:-3,right:-3,background:"var(--color-orange)"}}>{myNotifs.length}</span>}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={handleLogout} style={{height:34}}>Выйти</button>
            </div>
          </div>
        </div>
        {myBalance>DEMURRAGE_THRESHOLD&&<div style={{fontSize:"var(--text-2xs)",color:"var(--color-orange)",textAlign:"right",marginTop:2,width:"100%"}}>
          демередж: -{cur(calcDemurrage(myBalance,1))}/мес
        </div>}
      </div>

      {/* SEARCH */}
      <div style={{padding:"9px 20px 0",background:"var(--color-bg)"}}>
        <div className="search-wrap">
          <input className="search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию, категории…" />
          <span className="search-icon">🔍</span>
          {search&&<button className="search-clear" onClick={()=>setSearch("")}>×</button>}
        </div>
      </div>

      {/* TABS */}
      <div ref={tabsRef} className="htabs" style={{position:"relative",marginTop:8}}>
        {TABS_DEF.map(t=>{
          const badge=t.key==="requests"?requests.filter(r=>r.status==="open").length
            :t.key==="news"?pinnedNews.length:0;
          return <button key={t.key} onClick={()=>changeTab(t.key, tabKeys.indexOf(t.key) > tabIdx ? "left" : "right")}
            className={`htab${tab===t.key?" htab-active":""}`}>
            {t.l}
            {badge>0&&<span className="htab-badge">{badge}</span>}
          </button>;
        })}
      </div>
    </div>

    {/* NOTIFICATIONS DROPDOWN (overlay) */}
    {showNotifs&&<div style={{background:"var(--color-surface)",border:`1px solid ${"var(--color-border)"}`,
      borderRadius:0,borderLeft:"none",borderRight:"none",zIndex:45,maxHeight:260,overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",
        borderBottom:`1px solid ${"var(--color-border)"}`,position:"sticky",top:0,background:"var(--color-surface)",zIndex:1}}>
        <span style={{fontSize:11,color:"var(--color-text-muted)",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Уведомления</span>
        <div style={{display:"flex",gap:6}}>
          {notifications.filter(n=>n.memberId===meId&&!n.read).length>0&&
            <button onClick={async()=>{
              const ids=notifications.filter(n=>n.memberId===meId&&!n.read).map(n=>n.id);
              setNotifications(p=>p.map(x=>x.memberId===meId?{...x,read:true}:x));
              for(const id of ids) await sb.update("notifications",{id},{read:true});
            }}
              style={{fontSize:11,background:"none",border:`1px solid ${"var(--color-border)"}`,color:"var(--color-text-muted)",
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
        ?<div style={{padding:"16px 20px",fontSize:13,color:"var(--color-text-faint)"}}>Нет уведомлений</div>
        :notifications.filter(n=>n.memberId===meId).slice(0,15).map(n=>(
          <div key={n.id} onClick={async()=>{
              if(!n.read){ setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x)); await sb.update("notifications",{id:n.id},{read:true}); }
            }}
            style={{padding:"10px 16px",borderBottom:`1px solid ${"var(--color-border)"}`,cursor:"pointer",
              background:n.read?"transparent":"#6366f108",display:"flex",gap:10,alignItems:"flex-start"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--color-border)"}
            onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"#6366f108"}>
            <span style={{fontSize:16,opacity:n.read?0.5:1}}>{n.type==="gift"?"💛":n.type==="booking"?"📦":n.type==="bid"?"💬":n.type==="accepted"?"✅":"🔔"}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:n.read?"var(--color-text-tertiary)":"var(--color-text-primary)",lineHeight:1.4}}>{n.text}</div>
              <div style={{fontSize:10,color:"var(--color-text-faint)",marginTop:2,fontFamily:"monospace"}}>{n.date}</div>
            </div>
            {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:"#f97316",flexShrink:0,marginTop:4}} />}
          </div>
        ))}
    </div>}

    <div ref={scrollRef} style={{padding:"12px 20px",paddingBottom:80}} {...swipeMain}>

      <div key={tabKey} className={tabDir==="left"?"tab-enter-left":tabDir==="right"?"tab-enter-right":""}>

      {/* CAT FILTER */}
      {(tab==="offers"||tab==="requests")&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {(categories||CATEGORIES).map(c=><button key={c} onClick={()=>setCatFilter(c)}
          className={`chip ${catFilter===c?"chip-active":""}`}
          style={{fontSize:12}}>{CAT_ICONS[c]} {c}</button>)}
      </div>}

      {/* NEWS TAB */}
      {tab==="news"&&<div className="anim-fade-up">
        <div className="conv-forum" onClick={()=>setShowConstitution(true)}>
          <div style={{fontSize:22}}>📜</div>
          <div className="flex-1">
            <div style={{fontWeight:600,fontSize:"var(--text-base)",color:"var(--color-purple)"}}>Правила Общего фонда</div>
            <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginTop:1}}>Как работает система · Демередж · Роли</div>
          </div>
          <div style={{color:"var(--color-accent)",fontSize:"var(--text-base)"}}>→</div>
        </div>
        {allNews.length===0&&<div className="empty">Новостей пока нет</div>}
        <div className="stagger">
        {allNews.map(n=>{const author=findM(members,n.author);return (
          <div key={n.id} className="card" style={{borderColor:n.pinned?"var(--color-accent-border)":undefined,marginBottom:10}}>
            {n.pinned&&<div style={{fontSize:"var(--text-2xs)",color:"var(--color-accent)",marginBottom:5}}>📌 Закреплено</div>}
            <div style={{fontWeight:700,fontSize:"var(--text-lg)",marginBottom:6}}>{n.title}</div>
            <div style={{fontSize:"var(--text-sm)",color:"var(--color-text-secondary)",lineHeight:1.6,marginBottom:10}}>{n.body}</div>
            <div className="flex items-center gap-2">
              <Avatar member={author} size={20} />
              <span style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)"}}>{author.name.split(" ")[0]}</span>
              <span style={{fontSize:"var(--text-xs)",color:"var(--color-text-faint)",marginLeft:"auto",fontFamily:"var(--font-mono)"}}>{n.date}</span>
            </div>
          </div>
        );})}
        </div>
      </div>}

      {/* OFFERS */}
      {tab==="offers"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <button onClick={()=>setAddingOff(true)} className="btn btn-dashed" style={{borderRadius:14,marginBottom:11}}>
          ✦ Опубликовать предложение
        </button>
        {filtOffers.length===0&&<div className="empty">{search?"Ничего не найдено":"Нет предложений"}</div>}
        <div className="flex-col gap-2 stagger">
          {filtOffers.map(offer=>{const owner=findM(members,offer.member);
            return <div key={offer.id} className="card card-interactive flex gap-3"
              onClick={()=>{setSelOffer(offer);setBookQty(1);}}>
              {offer.photo
                ? <div onClick={e=>{e.stopPropagation();setLightbox(offer.photo);}} style={{width:54,height:54,borderRadius:"var(--radius-md)",overflow:"hidden",flexShrink:0,cursor:"zoom-in"}}><img src={offer.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
                : <div className="offer-icon">{CAT_ICONS[offer.category]}</div>}
              <div className="flex-1">
                <div className="offer-title" style={{marginBottom:3}}>{offer.title}</div>
                <div className="offer-desc" style={{lineHeight:1.4}}>{offer.desc}</div>
                <div className="flex justify-between items-center" style={{marginTop:7}}>
                  <div onClick={e=>{e.stopPropagation();setProfileTarget(owner);setView("profile");}} className="flex items-center gap-1" style={{cursor:"pointer"}}>
                    <Avatar member={owner} size={18} />
                    <span style={{fontSize:"var(--text-xs)",color:"var(--color-accent)"}}>{owner.name.split(" ")[0]}</span>
                  </div>
                  <span className="offer-price" style={{color:offer.price===0?"var(--color-success)":"var(--color-text-primary)"}}>{offer.price===0?"бесплатно":`${cur(offer.price)}/${offer.unit}`}</span>
                </div>
                <QtyBar qty={offer.qty} reserved={offer.reserved} />
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* REQUESTS */}
      {tab==="requests"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <button onClick={()=>setAddingReq(true)} className="btn btn-dashed" style={{borderRadius:14,marginBottom:11}}>🙋 Опубликовать запрос</button>
        {filtReqs.length===0&&<div style={{textAlign:"center",color:"var(--color-text-faint)",padding:"28px 0",fontSize:13}}>{search?"Ничего":"Запросов пока нет"}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {filtReqs.map(req=>{const author=findM(members,req.member),isMyReq=req.member===meId;
            const pendBids=req.bids.filter(b=>b.status==="pending").length;
            const myBid=req.bids.find(b=>b.from===meId);
            const reqTx=transactions.find(t=>t.reqId===req.id&&(t.status==="active"||t.status==="awaiting_confirm"));
            const canAcceptWork=isMyReq&&reqTx?.status==="awaiting_confirm";
            return <div key={req.id} style={{background:"var(--color-surface)",border:`1px solid ${canAcceptWork?"#4ade8040":req.status==="closed"?"#4ade8030":isMyReq?"#6366f130":"var(--color-border)"}`,borderRadius:14,padding:"13px 14px",cursor:"pointer"}}
              onClick={()=>setOpenReq(req)}
              onMouseEnter={e=>e.currentTarget.style.background="var(--color-border)"}
              onMouseLeave={e=>e.currentTarget.style.background="var(--color-surface)"}>
              <div style={{display:"flex",gap:11}}>
                <div style={{width:40,height:40,borderRadius:10,background:"var(--color-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{CAT_ICONS[req.category]||"🙋"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--color-text-primary)"}}>{req.title}</div>
                    {req.status==="closed"?<span style={{fontSize:11,color:"#4ade80",marginLeft:8,flexShrink:0}}>✓</span>
                      :isMyReq&&pendBids>0?<span style={{fontSize:11,background:"#f9713015",color:"#f97316",padding:"1px 7px",borderRadius:6,marginLeft:8,flexShrink:0}}>{pendBids} предл.</span>:null}
                  </div>
                  <div style={{fontSize:12,color:"var(--color-text-tertiary)",lineHeight:1.4}}>{req.desc}</div>
                  <div style={{marginTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <Avatar member={author} size={16} />
                      <span style={{fontSize:11,color:"var(--color-accent)"}}>{author.name.split(" ")[0]}</span>
                    </div>
                    {canAcceptWork&&<button onClick={e=>{e.stopPropagation();confirmTx(reqTx.id);}}
                      style={{background:"#052e16",border:"1px solid #166534",color:"#4ade80",padding:"4px 10px",
                        borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                      ✓ Принять работу
                    </button>}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {req.budget&&<span style={{fontSize:11,color:"#fbbf24"}}>до {cur(req.budget)}</span>}
                      {myBid&&myBid.status==="pending"&&<span style={{fontSize:11,color:"var(--color-text-secondary)"}}>вы: {cur(myBid.price)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* MEMBERS */}
      {tab==="members"&&<div className="flex-col gap-2 anim-fade-up">
        <div className="card" style={{marginBottom:4}}>
          <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginBottom:4}}>Сумма всех балансов = {cur(Object.values(balances).reduce((a,b)=>a+b,0))}</div>
          <div className="qty-bar-track">
            <div className="qty-bar-fill" style={{background:"linear-gradient(90deg,var(--color-accent),var(--color-success))",width:"100%"}} /></div>
          <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-faint)",marginTop:4}}>Взаимный кредит · {CUR.plural} созданы из доверия</div>
        </div>
        <div className="stagger">
        {members.map(m=>{
          const bal=balances[m.id]??m.balance;
          const pot=payPotential(m.id,offers,bal);
          return <div key={m.id} onClick={()=>{setProfileTarget(m);setView("profile");}}
            className="card card-interactive flex items-center gap-3"
            style={{borderColor:m.id===meId?"var(--color-accent-border)":m.frozen?"var(--color-border-strong)":undefined,
              opacity:m.frozen?0.6:1}}>
            <Avatar member={m} size={42} />
            <div className="flex-1">
              <div className="flex items-center gap-2 wrap">
                <span style={{fontWeight:600,fontSize:"var(--text-base)"}}>{m.name}</span>
                {m.id===meId&&<span className="profile-me-badge">вы</span>}
                <RoleBadge role={m.systemRole} />
                {m.frozen&&<span style={{fontSize:"var(--text-2xs)",color:"var(--color-text-tertiary)"}}>❄</span>}
              </div>
              <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginTop:2}}>{m.profession||(m.skills||[]).join(" · ")}</div>
              {pot!==bal&&<div style={{fontSize:"var(--text-2xs)",color:"var(--color-text-faint)",marginTop:1}}>потенциал: {cur(pot)}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Pill balance={bal} />
              <span style={{color:"var(--color-text-faint)"}}>›</span>
            </div>
          </div>;})}
        </div>
      </div>}

      {/* GRAPH */}
      {tab==="graph"&&<div style={{animation:"fadeUp 0.3s ease"}}>
        <div style={{fontSize:13,color:"var(--color-text-muted)",marginBottom:10}}>Нажми на участника → открыть профиль</div>
        <NetworkGraph members={members} transactions={transactions} invites={invites} onSelectMember={goToMember} />
      </div>}

      {/* LEDGER */}
      {tab==="ledger"&&<div className="anim-fade-up">
        <div className="section-label-sm" style={{marginBottom:10}}>Все транзакции публичны · {transactions.length} записей</div>
        {transactions.length===0&&<div className="empty">Транзакций пока нет</div>}
        <div className="flex-col gap-2 stagger">
          {[...transactions].sort((a,b)=>b.id-a.id).map(tx=>{const from=findM(members,tx.from),to=findM(members,tx.to);
            const isGift=tx.type==="gift",sc=S_COLOR[tx.status]||"#475569";
            return <div key={tx.id} className={`card card-compact${tx.status==="cancelled"?" tx-card-cancelled":""}`}>
              <div className="flex justify-between">
                <div className="flex-1">
                  <div className="flex gap-2 items-center" style={{marginBottom:4}}><span>{isGift?"💛":"⇄"}</span><span style={{fontSize:"var(--text-sm)",fontWeight:500}}>{tx.what}</span></div>
                  <div className="flex gap-1 items-center" style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)"}}>
                    <span onClick={()=>from.id&&goToMember(from.id)} style={{cursor:from.id?"pointer":"default",color:from.id?"var(--color-accent)":undefined}}>{from.name.split(" ")[0]}</span>
                    <span>→</span>
                    <span onClick={()=>to.id&&goToMember(to.id)} style={{cursor:to.id?"pointer":"default",color:to.id?"var(--color-accent)":undefined}}>{to.name.split(" ")[0]}</span>
                    <span className="badge" style={{background:`${sc}18`,color:sc}}>{S_LABEL[tx.status]||tx.status}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",marginLeft:10}}>
                  <div style={{fontSize:"var(--text-sm)",fontWeight:700,color:isGift?"var(--color-gold)":undefined}}>{cur(tx.amount)}</div>
                  <div style={{fontSize:"var(--text-2xs)",color:"var(--color-text-faint)",fontFamily:"var(--font-mono)"}}>{tx.date}</div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>}
    </div>

    {/* FOOTER — compact with bottom tab bar */}
    <div style={{margin:"24px 20px 0",padding:"16px 20px",background:"var(--color-surface)",border:`1px solid ${"var(--color-border)"}`,
      borderRadius:16,textAlign:"center"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:18}}>🌾</span>
        <span style={{fontWeight:700,fontSize:14,color:"var(--color-text-primary)"}}>Общий фонд</span>
      </div>
      <div style={{fontSize:12,color:"var(--color-text-muted)",lineHeight:1.5,marginBottom:12}}>
        Сообщество взаимопомощи на основе доверия
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:8}}>
        <button onClick={()=>setShowConstitution(true)}
          style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--color-accent)"+"12",
            border:`1px solid ${"var(--color-accent)"}25`,borderRadius:10,padding:"8px 14px",
            color:"#818cf8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          📜 Правила
        </button>
        <button onClick={()=>setShowGift(true)}
          style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fbbf2412",
            border:"1px solid #fbbf2425",borderRadius:10,padding:"8px 14px",
            color:"#fbbf24",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          💛 Подарить
        </button>
      </div>
      <div style={{marginTop:10,fontSize:10,color:"var(--color-text-faint)",fontFamily:"monospace"}}>
        v{APP_VERSION}
      </div>
    </div>{/* end tab animation wrapper */}
    </div>{/* end scroll container */}

    {/* BOOK SHEET */}
    {selOffer&&<Sheet onClose={()=>{setSelOffer(null);setTxNote("");setBookQty(1);}}>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        {selOffer.photo
          ? <div style={{width:54,height:54,borderRadius:12,overflow:"hidden",flexShrink:0}}><img src={selOffer.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
          : <div style={{width:48,height:48,borderRadius:12,background:"var(--color-border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{CAT_ICONS[selOffer.category]}</div>}
        <div><div style={{fontWeight:700,fontSize:16,color:"var(--color-text-primary)"}}>{selOffer.title}</div><div style={{fontSize:13,color:"var(--color-text-tertiary)",marginTop:3}}>{selOffer.desc}</div></div>
      </div>
      <QtyBar qty={selOffer.qty} reserved={selOffer.reserved} />
      <div style={{marginTop:13}}>
        <SL>Количество</SL>
        <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:12}}>
          <button onClick={()=>setBookQty(q=>Math.max(1,q-1))} style={{width:36,height:36,borderRadius:8,background:"var(--color-border)",border:"none",color:"var(--color-text-primary)",fontSize:20,cursor:"pointer"}}>−</button>
          <span style={{fontSize:20,fontWeight:700,minWidth:26,textAlign:"center",color:"var(--color-text-primary)"}}>{bookQty}</span>
          <button onClick={()=>setBookQty(q=>Math.min(selOffer.qty-selOffer.reserved,q+1))} style={{width:36,height:36,borderRadius:8,background:"var(--color-border)",border:"none",color:"var(--color-text-primary)",fontSize:20,cursor:"pointer"}}>+</button>
          <span style={{fontSize:12,color:"var(--color-text-tertiary)"}}>доступно: {selOffer.qty-selOffer.reserved}</span>
        </div>
      </div>
      {selOffer.price>0?<>
        <IRow label={`Итого ×${bookQty}`}><span style={{fontWeight:700,fontSize:17,color:"var(--color-text-primary)"}}>{cur(selOffer.price*bookQty)}</span></IRow>
        <IRow label="Баланс после"><Pill balance={myBalance-selOffer.price*bookQty} /></IRow>
      </>:<IRow label="Стоимость"><span style={{color:"#4ade80",fontWeight:600}}>бесплатно</span></IRow>}
      <FI value={txNote} onChange={setTxNote} placeholder="Сообщение…" multi />
      <PB onClick={doBook} disabled={(selOffer.qty-selOffer.reserved)<bookQty||selOffer.member===meId}>
          {selOffer.member===meId?"Это ваше предложение":`Забронировать${bookQty>1?` ×${bookQty}`:""}`}
        </PB>
      {selOffer.member!==meId&&<PB v="ghost" s={{marginTop:8}} onClick={()=>{
        const seller=members.find(m=>m.id===selOffer.member);
        const msg=`💬 По предложению «${selOffer.title}»`;
        setSelOffer(null); setTxNote(""); setBookQty(1);
        openChatWith(selOffer.member, msg);
      }}>💬 Написать продавцу</PB>}
    </Sheet>}

    {/* GIFT SHEET */}
    {showGift&&<Sheet onClose={()=>{setShowGift(false);setGiftCustom("");}}>
      <div style={{fontSize:18,fontWeight:700,marginBottom:4,color:"var(--color-text-primary)"}}>💛 Передать дар</div>
      <div style={{fontSize:13,color:"var(--color-text-muted)",marginBottom:14}}>Дар не создаёт обязательств</div>
      <SL>Кому</SL>
      <GiftMemberPicker members={members} meId={meId} giftTo={giftTo} setGiftTo={setGiftTo} balances={balances} T={T} />
      <SL>Размер</SL>
      <div style={{display:"flex",gap:7,marginBottom:9}}>
        {[5,10,20,50].map(n=><button key={n} onClick={()=>{setGiftAmt(n);setGiftCustom("");}} style={{flex:1,
          background:giftAmt===n&&!giftCustom?"var(--color-accent)":"var(--color-input)",
          border:`1px solid ${giftAmt===n&&!giftCustom?"var(--color-accent)":"var(--color-border)"}`,
          color:giftAmt===n&&!giftCustom?"#fff":"var(--color-text-secondary)",
          padding:"7px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>)}
      </div>
      <input type="number" min="1" value={giftCustom} onChange={e=>{setGiftCustom(e.target.value);setGiftAmt(0);}}
        placeholder="Или введи свою сумму…"
        style={{width:"100%",background:"var(--color-input)",border:`1px solid ${giftCustom?"var(--color-accent)":"var(--color-border)"}`,borderRadius:10,
          color:"var(--color-text-primary)",padding:"10px 14px",fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:11}} />
      <FI value={giftMsg} onChange={setGiftMsg} placeholder="Слово дара…" multi s={{height:60}} />
      <PB v="gold" onClick={doGift} disabled={!giftTo}>Передать {cur(giftCustom?Number(giftCustom):giftAmt)} · без условий</PB>
    </Sheet>}

    {addingReq&&<RequestForm T={T} categories={categories} onClose={()=>setAddingReq(false)} onSave={d=>{addRequest(d);setAddingReq(false);}} />}
    {addingOff&&<OfferForm T={T} categories={categories} onClose={()=>setAddingOff(false)} onSave={d=>{addOffer(d);setAddingOff(false);}} />}
    {openReq&&<RequestDetail T={T} request={openReq} members={members} meId={meId}
      onAcceptBid={(rId,bId)=>{acceptBid(rId,bId);setOpenReq(null);}}
      onDeclineBid={declineBid}
      onBid={(rId,p,n)=>{addBid(rId,p,n);setOpenReq(requests.find(r=>r.id===rId)||openReq);}}
      onClose={()=>setOpenReq(null)}
      onChatWith={openChatWith} />}
    {lightbox&&<Lightbox src={lightbox} onClose={()=>setLightbox(null)} />}
    {showReviewFor&&<ReviewForm T={T} tx={showReviewFor} members={members} meId={meId}
      onSave={d=>{addReview(d);setShowReviewFor(null);}}
      onClose={()=>setShowReviewFor(null)} />}
    <BottomTabBar />
    </div>
  </div>;
}
