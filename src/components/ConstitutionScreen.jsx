import { useState } from "react";
import useSwipe from "../hooks/useSwipe";
import { DEMURRAGE_RATE, DEMURRAGE_THRESHOLD, APP_VERSION } from "../lib/constants";

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

export default ConstitutionScreen;
