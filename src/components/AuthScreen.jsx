import { useState } from 'react';
import { THEMES } from '../lib/constants';
import { SL, FI, PB } from './ui';
import { GCSS } from '../lib/styles';

export default function AuthScreen({ invites, members, accounts, onLogin, onRegister, T: T_prop }) {
  const T = T_prop || THEMES.dark;
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [pass, setPass] = useState("");
  const [showP, setShowP] = useState(false);
  const [error, setError] = useState("");
  const [invCode, setInvCode] = useState("");
  const [rName, setRName] = useState("");
  const [rLogin, setRLogin] = useState("");
  const [rPass, setRPass] = useState("");
  const [rProf, setRProf] = useState("");
  const [rBio, setRBio] = useState("");
  const [rTg, setRTg] = useState("");
  const [step, setStep] = useState(1);
  const [registering, setRegistering] = useState(false);

  function doLogin() {
    const acc = accounts.find(a => a.login === login.toLowerCase().trim() && a.password === pass);
    if (!acc) { setError("Неверный логин или пароль"); return; }
    const m = members.find(m => m.id === acc.memberId);
    if (m?.frozen) { setError("Аккаунт заморожен. Обратитесь к администратору"); return; }
    onLogin(acc.memberId);
  }
  function checkInvite() {
    const inv = invites.find(i => i.code === invCode.trim().toUpperCase() && !i.usedBy);
    if (!inv) { setError("Инвайт не найден или уже использован"); return; }
    setError(""); setStep(2);
  }
  function doRegister() {
    if (registering) return;
    if (!rName.trim() || !rLogin.trim() || !rPass.trim()) { setError("Заполни все поля"); return; }
    if (!/^[a-z0-9_]+$/.test(rLogin)) { setError("Логин: только латинские буквы и цифры"); return; }
    if (accounts.find(a => a.login === rLogin.toLowerCase().trim())) { setError("Логин занят"); return; }
    setRegistering(true);
    onRegister({ invCode: invCode.trim().toUpperCase(), name: rName, login: rLogin.toLowerCase().trim(), password: rPass, profession: rProf, bio: rBio, telegram: rTg });
  }

  return <div style={{
    minHeight: "100vh", background: T.bg, color: T.text,
    fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: "24px", maxWidth: 480, margin: "0 auto"
  }}>
    <style>{GCSS}</style>
    <div style={{ marginBottom: 28, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>🌾</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>Общий фонд</div>
      <div style={{ fontSize: 13, color: T.text4, marginTop: 4 }}>Сообщество взаимного обмена</div>
    </div>
    {mode === "login" && <div style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "24px 20px" }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Войти</div>
      <SL>Логин</SL><FI T={T} value={login} onChange={v => { setLogin(v.replace(/[^a-z0-9_]/g, "").toLowerCase()); setError(""); }} placeholder="login" />
      <SL>Пароль</SL>
      <div style={{ position: "relative", marginBottom: 11 }}>
        <input type={showP ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setError(""); }} placeholder="••••••••"
          style={{
            width: "100%", background: T.input, border: `1px solid ${T.border}`, borderRadius: 10,
            color: T.text, padding: "11px 40px 11px 14px", fontSize: 14, fontFamily: "inherit", outline: "none"
          }} />
        <button onClick={() => setShowP(!showP)} style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 14
        }}>{showP ? "🙈" : "👁"}</button>
      </div>
      {error && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{error}</div>}
      <PB onClick={doLogin} disabled={!login || !pass}>Войти</PB>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: T.text4 }}>
        Нет аккаунта?{" "}<span onClick={() => { setMode("register"); setError(""); setStep(1); }} style={{ color: "#6366f1", cursor: "pointer" }}>Зарегистрироваться</span>
      </div>
    </div>}

    {mode === "register" && <div style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        {step > 1 && <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>←</button>}
        <div style={{ fontSize: 18, fontWeight: 700 }}>{step === 1 ? "Инвайт" : step === 2 ? "О себе" : "Аккаунт"}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ width: i <= step ? 18 : 7, height: 5, borderRadius: 3, background: i <= step ? "#6366f1" : T.border, transition: "all 0.2s" }} />)}
        </div>
      </div>
      {step === 1 && <>
        <div style={{ fontSize: 13, color: T.text3, marginBottom: 14, lineHeight: 1.5 }}>Регистрация только по приглашению.</div>
        <SL>Код инвайта</SL>
        <FI value={invCode} onChange={v => { setInvCode(v); setError(""); }} placeholder="FOND-XXXX" s={{ fontFamily: "'DM Mono',monospace", letterSpacing: 1 }} />
        {error && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{error}</div>}
        <PB onClick={checkInvite} disabled={invCode.trim().length < 6}>Проверить</PB>
      </>}
      {step === 2 && <>
        <SL>Имя и фамилия</SL><FI value={rName} onChange={v => { setRName(v); setError(""); }} placeholder="Иван Петров" />
        <SL>Профессия</SL><FI value={rProf} onChange={setRProf} placeholder="Повар, дизайнер…" />
        <SL>Чем могу быть полезен</SL><FI value={rBio} onChange={setRBio} placeholder="Что умею…" multi />
        <SL>Telegram</SL><FI value={rTg} onChange={setRTg} placeholder="@username" s={{ marginBottom: 4 }} />
        <PB onClick={() => { if (!rName.trim()) { setError("Введи имя"); return; } setError(""); setStep(3); }} s={{ marginTop: 10 }}>Далее →</PB>
        {error && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{error}</div>}
      </>}
      {step === 3 && <>
        <SL>Логин</SL>
        <FI T={T} value={rLogin} onChange={v => { setRLogin(v.replace(/[^a-z0-9_]/g, "").toLowerCase()); setError(""); }} placeholder="ivan.petrov" />
        <div style={{ fontSize: 11, color: T.text5, marginTop: -8, marginBottom: 8 }}>Только латинские буквы, цифры и _</div>
        <SL>Пароль</SL>
        <div style={{ position: "relative", marginBottom: 11 }}>
          <input type={showP ? "text" : "password"} value={rPass} onChange={e => { setRPass(e.target.value); setError(""); }} placeholder="Минимум 6 символов"
            style={{
              width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10,
              color: T.text, padding: "11px 40px 11px 14px", fontSize: 14, fontFamily: "inherit", outline: "none"
            }} />
          <button onClick={() => setShowP(!showP)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 14
          }}>{showP ? "🙈" : "👁"}</button>
        </div>
        {error && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>{error}</div>}
        <PB onClick={doRegister} disabled={!rLogin || rPass.length < 6 || registering}>
          {registering ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </PB>
      </>}
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: T.text4 }}>
        Есть аккаунт?{" "}<span onClick={() => { setMode("login"); setError(""); }} style={{ color: "#6366f1", cursor: "pointer" }}>Войти</span>
      </div>
    </div>}
  </div>;
}
