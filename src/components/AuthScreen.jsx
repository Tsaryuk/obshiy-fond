import { useState } from 'react';
import { SL, FI, PB } from './ui';

export default function AuthScreen({ invites, members, accounts, onLogin, onRegister }) {
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

  return <div className="flex-col items-center justify-center" style={{
    minHeight: "100vh", padding: 24, maxWidth: 480, margin: "0 auto"
  }}>
    <div style={{ marginBottom: 28, textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>🌾</div>
      <div style={{ fontSize: "var(--text-3xl)", fontWeight: 700, letterSpacing: "var(--tracking-tight)" }}>Общий фонд</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 4 }}>Сообщество взаимного обмена</div>
    </div>
    {mode === "login" && <div className="card" style={{ width: "100%", borderRadius: "var(--radius-xl)", padding: "24px 20px" }}>
      <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: 18 }}>Войти</div>
      <SL>Логин</SL><FI value={login} onChange={v => { setLogin(v.replace(/[^a-z0-9_]/g, "").toLowerCase()); setError(""); }} placeholder="login" />
      <SL>Пароль</SL>
      <div className="relative" style={{ marginBottom: 11 }}>
        <input className="input" type={showP ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setError(""); }} placeholder="••••••••"
          style={{ paddingRight: 40 }} />
        <button onClick={() => setShowP(!showP)} style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 14
        }}>{showP ? "🙈" : "👁"}</button>
      </div>
      {error && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginBottom: 10 }}>{error}</div>}
      <PB onClick={doLogin} disabled={!login || !pass}>Войти</PB>
      <div className="text-center" style={{ marginTop: 12, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Нет аккаунта?{" "}<span onClick={() => { setMode("register"); setError(""); setStep(1); }} style={{ color: "var(--color-accent)", cursor: "pointer" }}>Зарегистрироваться</span>
      </div>
    </div>}

    {mode === "register" && <div className="card" style={{ width: "100%", borderRadius: "var(--radius-xl)", padding: "24px 20px" }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 18 }}>
        {step > 1 && <button className="back-btn" onClick={() => setStep(step - 1)}>←</button>}
        <div style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>{step === 1 ? "Инвайт" : step === 2 ? "О себе" : "Аккаунт"}</div>
        <div className="steps" style={{ marginLeft: "auto" }}>
          {[1, 2, 3].map(i => <div key={i} className={i <= step ? "step step-active" : "step step-inactive"} />)}
        </div>
      </div>
      {step === 1 && <>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", marginBottom: 14, lineHeight: 1.5 }}>Регистрация только по приглашению.</div>
        <SL>Код инвайта</SL>
        <FI value={invCode} onChange={v => { setInvCode(v); setError(""); }} placeholder="FOND-XXXX" s={{ fontFamily: "var(--font-mono)", letterSpacing: 1 }} />
        {error && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginBottom: 10 }}>{error}</div>}
        <PB onClick={checkInvite} disabled={invCode.trim().length < 6}>Проверить</PB>
      </>}
      {step === 2 && <>
        <SL>Имя и фамилия</SL><FI value={rName} onChange={v => { setRName(v); setError(""); }} placeholder="Иван Петров" />
        <SL>Профессия</SL><FI value={rProf} onChange={setRProf} placeholder="Повар, дизайнер…" />
        <SL>Чем могу быть полезен</SL><FI value={rBio} onChange={setRBio} placeholder="Что умею…" multi />
        <SL>Telegram</SL><FI value={rTg} onChange={setRTg} placeholder="@username" s={{ marginBottom: 4 }} />
        <PB onClick={() => { if (!rName.trim()) { setError("Введи имя"); return; } setError(""); setStep(3); }} s={{ marginTop: 10 }}>Далее →</PB>
        {error && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginTop: 8 }}>{error}</div>}
      </>}
      {step === 3 && <>
        <SL>Логин</SL>
        <FI value={rLogin} onChange={v => { setRLogin(v.replace(/[^a-z0-9_]/g, "").toLowerCase()); setError(""); }} placeholder="ivan.petrov" />
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-faint)", marginTop: -8, marginBottom: 8 }}>Только латинские буквы, цифры и _</div>
        <SL>Пароль</SL>
        <div className="relative" style={{ marginBottom: 11 }}>
          <input className="input" type={showP ? "text" : "password"} value={rPass} onChange={e => { setRPass(e.target.value); setError(""); }} placeholder="Минимум 6 символов"
            style={{ paddingRight: 40 }} />
          <button onClick={() => setShowP(!showP)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 14
          }}>{showP ? "🙈" : "👁"}</button>
        </div>
        {error && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)", marginBottom: 10 }}>{error}</div>}
        <PB onClick={doRegister} disabled={!rLogin || rPass.length < 6 || registering}>
          {registering ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </PB>
      </>}
      <div className="text-center" style={{ marginTop: 12, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Есть аккаунт?{" "}<span onClick={() => { setMode("login"); setError(""); }} style={{ color: "var(--color-accent)", cursor: "pointer" }}>Войти</span>
      </div>
    </div>}
  </div>;
}
