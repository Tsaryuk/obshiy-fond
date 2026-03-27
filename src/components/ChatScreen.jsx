import { useState, useRef, useEffect } from 'react';
import useSwipe from '../hooks/useSwipe';
import { Avatar } from './ui';

export default function ChatScreen({ meId, members, messages, groupMessages, onSend, onBack, T, onSelectMember, initialPeerId, initialMsg }) {
  const [view, setView] = useState("list");
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState("");
  const endRef = useRef();
  const swipe = useSwipe(() => {
    if (view === "thread" || view === "group") setView("list");
    else onBack();
  });

  useEffect(() => {
    if (initialPeerId) {
      const m = members.find(x => x.id === initialPeerId);
      if (m) { setPeer(m); setView("thread"); if (initialMsg) setText(initialMsg); }
    }
  }, [initialPeerId]);

  const convs = members.filter(m => m.id !== meId).map(m => {
    const thread = messages.filter(msg => (msg.from === meId && msg.to === m.id) || (msg.from === m.id && msg.to === meId));
    const last = thread[thread.length - 1];
    const unread = thread.filter(msg => msg.to === meId && !msg.read).length;
    return { member: m, thread, last, unread };
  }).filter(c => c.thread.length > 0 || c.member.id === peer?.id)
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));

  function openThread(m) { setPeer(m); setView("thread"); onSend(null, m.id, null); }

  function sendMsg() {
    if (!text.trim()) return;
    if (view === "group") { onSend(meId, "group", text.trim()); }
    else if (peer) { onSend(meId, peer.id, text.trim()); }
    setText("");
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const peerThread = peer ? messages.filter(msg => (msg.from === meId && msg.to === peer.id) || (msg.from === peer.id && msg.to === meId)) : [];

  const inputBar = (placeholder) => (
    <div style={{ padding: "10px 16px 16px", borderTop: `1px solid ${T.border}`, background: T.bg, display: "flex", gap: 8 }}>
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && (sendMsg(), e.preventDefault())}
        placeholder={placeholder} style={{
          flex: 1, background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 20, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none"
        }} />
      <button onClick={sendMsg} style={{
        background: "#6366f1", border: "none", borderRadius: "50%", width: 38, height: 38,
        color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>↑</button>
    </div>
  );

  if (view === "group") return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }} {...swipe}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>← назад</button>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6366f120", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌾</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Общий форум</div>
          <div style={{ fontSize: 11, color: T.text4 }}>{members.length} участников</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {groupMessages.length === 0 && <div style={{ textAlign: "center", color: T.text5, marginTop: 40, fontSize: 13 }}>Напиши первым! 👋</div>}
        {groupMessages.map((msg, i) => {
          const isMe = msg.from === meId;
          const sender = members.find(m => m.id === msg.from);
          return <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
            {!isMe && <div onClick={() => onSelectMember && onSelectMember(msg.from)} style={{ fontSize: 10, color: T.accent, marginBottom: 2, marginLeft: 8, cursor: "pointer" }}>{sender?.name?.split(" ")[0] || "?"}</div>}
            <div style={{
              maxWidth: "78%", background: isMe ? "#6366f1" : T.card,
              border: isMe ? "none" : `1px solid ${T.border}`,
              borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "9px 13px", color: isMe ? "#fff" : T.text
            }}>
              <div style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</div>
              <div style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.6)" : T.text5, marginTop: 3, textAlign: "right" }}>{msg.time}</div>
            </div>
          </div>;
        })}
        <div ref={endRef} />
      </div>
      {inputBar("Написать в форум…")}
    </div>
  );

  if (view === "thread" && peer) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }} {...swipe}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>← назад</button>
        <Avatar member={peer} size={34} />
        <div>
          <div onClick={() => onSelectMember && onSelectMember(peer.id)} style={{ fontWeight: 600, fontSize: 14, color: T.accent, cursor: "pointer" }}>{peer.name} →</div>
          <div style={{ fontSize: 11, color: T.text4 }}>{peer.profession || "участник"}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {peerThread.length === 0 && <div style={{ textAlign: "center", color: T.text5, marginTop: 40, fontSize: 13 }}>Начни переписку 👋</div>}
        {peerThread.map((msg, i) => {
          const isMe = msg.from === meId;
          return <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%", background: isMe ? "#6366f1" : T.card,
              border: isMe ? "none" : `1px solid ${T.border}`,
              borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "9px 13px", color: isMe ? "#fff" : T.text
            }}>
              <div style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</div>
              <div style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.6)" : T.text5, marginTop: 3, textAlign: "right" }}>{msg.time}</div>
            </div>
          </div>;
        })}
        <div ref={endRef} />
      </div>
      {inputBar(`Написать ${peer.name.split(" ")[0]}…`)}
    </div>
  );

  return (
    <div style={{ animation: "fadeUp 0.25s ease", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif" }} {...swipe}>
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>← назад</button>
        <div style={{ fontSize: 19, fontWeight: 700 }}>Сообщения</div>
      </div>
      <div style={{ padding: "12px 20px" }}>
        <div onClick={() => setView("group")} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          background: "#6366f115", border: "1px solid #6366f130", borderRadius: 14, marginBottom: 14, cursor: "pointer"
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#6366f120"}
          onMouseLeave={e => e.currentTarget.style.background = "#6366f115"}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#6366f120", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🌾</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#818cf8" }}>Общий форум</div>
            <div style={{ fontSize: 12, color: T.text4, marginTop: 1 }}>
              {groupMessages.length > 0
                ? groupMessages[groupMessages.length - 1].text.slice(0, 40) + "…"
                : `${members.length} участников · Общий чат`}
            </div>
          </div>
          {groupMessages.length > 0 && <div style={{ fontSize: 11, color: T.text5 }}>{groupMessages[groupMessages.length - 1].time}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.text4, marginBottom: 8 }}>Личные сообщения</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {members.filter(m => m.id !== meId && !m.frozen).map(m => (
              <div key={m.id} onClick={() => { setPeer(m); setView("thread"); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}>
                <Avatar member={m} size={40} />
                <div style={{ fontSize: 10, color: T.text3, maxWidth: 48, textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {convs.length === 0 && <div style={{ textAlign: "center", color: T.text5, padding: "24px 0", fontSize: 13 }}>Нет переписок — выбери участника выше</div>}
        {convs.map(({ member: m, thread, last, unread }) => (
          <div key={m.id} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 13px",
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 13, marginBottom: 8
          }}
            onMouseEnter={e => e.currentTarget.style.background = T.border}
            onMouseLeave={e => e.currentTarget.style.background = T.card}>
            <div onClick={() => openThread(m)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar member={m} size={42} />
                {unread > 0 && <div style={{
                  position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: "50%",
                  background: "#6366f1", fontSize: 9, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center"
                }}>{unread}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: T.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {last ? (last.from === meId ? "Вы: " : "") + last.text : "Нет сообщений"}
                </div>
              </div>
              {last && <div style={{ fontSize: 10, color: T.text5, flexShrink: 0 }}>{last.time}</div>}
            </div>
            <button onClick={() => onSelectMember && onSelectMember(m.id)}
              style={{ background: "none", border: `1px solid ${T.border}`, color: T.text4, fontSize: 12, padding: "4px 8px", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}>👤</button>
          </div>
        ))}
      </div>
    </div>
  );
}
