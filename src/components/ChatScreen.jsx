import { useState, useRef, useEffect, useCallback } from 'react';
import useSwipe from '../hooks/useSwipe';
import { Avatar } from './ui';

// Notification sound (short beep via Web Audio API)
let audioCtx = null;
function playNotifSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) { /* ignore audio errors */ }
}

// Parse @mentions in text and return React nodes
function renderMessageText(text, members, T, onSelectMember) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  const regex = /@(\S+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const mentionName = match[1].toLowerCase();
    const member = members.find(m => m.name.toLowerCase().startsWith(mentionName));
    if (member) {
      parts.push(
        <span key={match.index} onClick={(e) => { e.stopPropagation(); onSelectMember?.(member.id); }}
          style={{ color: "#818cf8", fontWeight: 600, cursor: "pointer" }}>@{member.name.split(" ")[0]}</span>
      );
    } else {
      parts.push(match[0]);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export default function ChatScreen({ meId, members, messages, groupMessages, onSend, onEdit, onDelete, onBack, T, onSelectMember, initialPeerId, initialMsg }) {
  const [view, setView] = useState("list");
  const [peer, setPeer] = useState(null);
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // autocomplete query
  const [mentionIdx, setMentionIdx] = useState(0);
  const [editingMsg, setEditingMsg] = useState(null); // msg being edited
  const [contextMenu, setContextMenu] = useState(null); // {msg, x, y}
  const [attachment, setAttachment] = useState(null); // File object
  const [typingPeers, setTypingPeers] = useState({}); // {peerId: timestamp}
  const [prevMsgCount, setPrevMsgCount] = useState(0);
  const endRef = useRef();
  const inputRef = useRef();
  const fileRef = useRef();
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

  // Sound notification on new messages
  useEffect(() => {
    const total = messages.length + groupMessages.length;
    if (prevMsgCount > 0 && total > prevMsgCount) {
      // Check if the newest message is not from me
      const allMsgs = [...messages, ...groupMessages];
      const newest = allMsgs[allMsgs.length - 1];
      if (newest && newest.from !== meId) playNotifSound();
    }
    setPrevMsgCount(total);
  }, [messages.length, groupMessages.length]);

  // Typing indicator: broadcast via simple state (polling-compatible)
  const lastTypingRef = useRef(0);
  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    setText(val);

    // @mention autocomplete detection
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }

    // Typing indicator signal
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
      // For typing indicator we use a lightweight approach via the existing polling
      // Store typing state in component — peers see it via presence polling
    }
  }, []);

  // Filtered members for @mention autocomplete
  const mentionMembers = mentionQuery !== null
    ? members.filter(m => m.id !== meId && m.name.toLowerCase().includes(mentionQuery)).slice(0, 5)
    : [];

  function insertMention(member) {
    const cursor = inputRef.current?.selectionStart || text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const atIdx = before.lastIndexOf("@");
    const newText = before.slice(0, atIdx) + `@${member.name.split(" ")[0]} ` + after;
    setText(newText);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Conversations list
  const convs = members.filter(m => m.id !== meId).map(m => {
    const thread = messages.filter(msg => (msg.from === meId && msg.to === m.id) || (msg.from === m.id && msg.to === meId));
    const last = thread[thread.length - 1];
    const unread = thread.filter(msg => msg.to === meId && !msg.read).length;
    return { member: m, thread, last, unread };
  }).filter(c => c.thread.length > 0 || c.member.id === peer?.id)
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));

  // Search filter
  const filteredConvs = searchQuery
    ? convs.filter(c => {
        const q = searchQuery.toLowerCase();
        if (c.member.name.toLowerCase().includes(q)) return true;
        return c.thread.some(msg => msg.text.toLowerCase().includes(q));
      })
    : convs;

  function openThread(m) { setPeer(m); setView("thread"); onSend(null, m.id, null); }

  function sendMsg() {
    if (!text.trim() && !attachment) return;
    if (editingMsg) {
      onEdit(editingMsg.id, text.trim(), view === "group");
      setEditingMsg(null);
      setText("");
      return;
    }
    if (view === "group") { onSend(meId, "group", text.trim(), attachment); }
    else if (peer) { onSend(meId, peer.id, text.trim(), attachment); }
    setText("");
    setAttachment(null);
    setMentionQuery(null);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function startEdit(msg) {
    setEditingMsg(msg);
    setText(msg.text);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingMsg(null);
    setText("");
  }

  function handleDelete(msg) {
    onDelete(msg.id, view === "group");
    setContextMenu(null);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
  }

  function handleContextMenu(e, msg) {
    if (msg.from !== meId || msg.deleted) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ msg, x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 });
  }

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, groupMessages.length, view]);

  // Render a single message bubble
  const renderBubble = (msg, i, isGroupView) => {
    const isMe = msg.from === meId;
    const sender = isGroupView ? members.find(m => m.id === msg.from) : null;

    if (msg.deleted) {
      return (
        <div key={msg.id || i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
          <div style={{
            maxWidth: "75%", background: "transparent", border: `1px dashed ${T.border}`,
            borderRadius: 16, padding: "9px 13px", color: T.text5, fontStyle: "italic", fontSize: 13
          }}>
            Сообщение удалено
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id || i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
        {isGroupView && !isMe && (
          <div onClick={() => onSelectMember?.(msg.from)}
            style={{ fontSize: 10, color: T.accent, marginBottom: 2, marginLeft: 8, cursor: "pointer" }}>
            {sender?.name?.split(" ")[0] || "?"}
          </div>
        )}
        <div
          onContextMenu={(e) => handleContextMenu(e, msg)}
          onTouchStart={(e) => {
            if (msg.from !== meId || msg.deleted) return;
            const timer = setTimeout(() => handleContextMenu(e, msg), 500);
            e.currentTarget._longPress = timer;
          }}
          onTouchEnd={(e) => { clearTimeout(e.currentTarget._longPress); }}
          onTouchMove={(e) => { clearTimeout(e.currentTarget._longPress); }}
          style={{
            maxWidth: "78%", background: isMe ? "#6366f1" : T.card,
            border: isMe ? "none" : `1px solid ${T.border}`,
            borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "9px 13px", color: isMe ? "#fff" : T.text, position: "relative",
            cursor: msg.from === meId ? "context-menu" : "default"
          }}
        >
          {/* Attachment */}
          {msg.attachment && (
            <div style={{ marginBottom: msg.text ? 6 : 0 }}>
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment) ? (
                <img src={msg.attachment} alt={msg.attachmentName || "photo"}
                  style={{ maxWidth: "100%", borderRadius: 10, cursor: "pointer", maxHeight: 200, objectFit: "cover" }}
                  onClick={(e) => { e.stopPropagation(); window.open(msg.attachment, "_blank"); }} />
              ) : (
                <a href={msg.attachment} target="_blank" rel="noopener noreferrer"
                  style={{ color: isMe ? "#c7d2fe" : "#818cf8", fontSize: 13, textDecoration: "underline" }}
                  onClick={(e) => e.stopPropagation()}>
                  {msg.attachmentName || "Файл"}
                </a>
              )}
            </div>
          )}

          {/* Text with @mentions */}
          {msg.text && (
            <div style={{ fontSize: 14, lineHeight: 1.4 }}>
              {renderMessageText(msg.text, members, T, onSelectMember)}
            </div>
          )}

          {/* Time + edited label */}
          <div style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.6)" : T.text5, marginTop: 3, textAlign: "right" }}>
            {msg.edited && <span style={{ marginRight: 4 }}>ред.</span>}
            {msg.time}
          </div>
        </div>
      </div>
    );
  };

  // Context menu overlay
  const contextMenuUI = contextMenu && (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
    }} onClick={() => setContextMenu(null)}>
      <div style={{
        position: "absolute", top: Math.min(contextMenu.y, window.innerHeight - 100),
        left: Math.min(contextMenu.x, window.innerWidth - 140),
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)", overflow: "hidden", minWidth: 130, zIndex: 1001
      }} onClick={(e) => e.stopPropagation()}>
        <div onClick={() => startEdit(contextMenu.msg)}
          style={{ padding: "10px 14px", fontSize: 13, color: T.text, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}
          onMouseEnter={(e) => e.currentTarget.style.background = T.border}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          Редактировать
        </div>
        <div onClick={() => handleDelete(contextMenu.msg)}
          style={{ padding: "10px 14px", fontSize: 13, color: "#f87171", cursor: "pointer" }}
          onMouseEnter={(e) => e.currentTarget.style.background = T.border}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          Удалить
        </div>
      </div>
    </div>
  );

  // Mention autocomplete popup
  const mentionPopup = mentionMembers.length > 0 && (
    <div style={{
      position: "absolute", bottom: "100%", left: 16, right: 16, marginBottom: 4,
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.2)", overflow: "hidden", zIndex: 50
    }}>
      {mentionMembers.map((m, i) => (
        <div key={m.id} onClick={() => insertMention(m)}
          style={{
            padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            background: i === mentionIdx ? T.border : "transparent", fontSize: 13, color: T.text
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = T.border}
          onMouseLeave={(e) => e.currentTarget.style.background = i === mentionIdx ? T.border : "transparent"}>
          <Avatar member={m} size={28} />
          <div>
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 11, color: T.text4 }}>{m.profession || "участник"}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // Input bar with attachment button, mention autocomplete, edit mode
  const inputBar = (placeholder) => (
    <div style={{ position: "relative", borderTop: `1px solid ${T.border}`, background: T.bg }}>
      {mentionPopup}

      {/* Edit mode banner */}
      {editingMsg && (
        <div style={{
          padding: "6px 16px", background: "#6366f115", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#818cf8"
        }}>
          <span>Редактирование сообщения</span>
          <button onClick={cancelEdit} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 16, padding: 0 }}>x</button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div style={{
          padding: "6px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.text3,
          borderBottom: `1px solid ${T.border}`
        }}>
          <span>{attachment.name}</span>
          <button onClick={() => setAttachment(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0 }}>x</button>
        </div>
      )}

      <div style={{ padding: "10px 16px 16px", display: "flex", gap: 8, alignItems: "center" }}>
        {/* File attach button */}
        <button onClick={() => fileRef.current?.click()} style={{
          background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0
        }}>+</button>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />

        <input ref={inputRef} value={text} onChange={handleTextChange}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { sendMsg(); e.preventDefault(); }
            if (e.key === "Escape" && editingMsg) cancelEdit();
            // Arrow keys for mention navigation
            if (mentionMembers.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMembers.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
              if (e.key === "Tab" || e.key === "Enter") {
                if (mentionMembers[mentionIdx]) { e.preventDefault(); insertMention(mentionMembers[mentionIdx]); }
              }
            }
          }}
          placeholder={placeholder} style={{
            flex: 1, background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 20, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none"
          }} />
        <button onClick={sendMsg} style={{
          background: editingMsg ? "#22c55e" : "#6366f1", border: "none", borderRadius: "50%", width: 38, height: 38,
          color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>{editingMsg ? "ok" : String.fromCharCode(8593)}</button>
      </div>
    </div>
  );

  // ── GROUP VIEW ──
  if (view === "group") {
    const filteredGroupMsgs = searchQuery
      ? groupMessages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : groupMessages;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }} {...swipe}>
        {contextMenuUI}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => { setView("list"); setSearchQuery(""); }} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>
            {String.fromCharCode(8592)} назад
          </button>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#6366f120", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {String.fromCharCode(127806)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>Общий форум</div>
            <div style={{ fontSize: 11, color: T.text4 }}>{members.length} участников</div>
          </div>
          <button onClick={() => setShowSearch(s => !s)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 16, padding: 0 }}>
            {String.fromCharCode(128269)}
          </button>
        </div>

        {showSearch && (
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по сообщениям..." autoFocus
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredGroupMsgs.length === 0 && (
            <div style={{ textAlign: "center", color: T.text5, marginTop: 40, fontSize: 13 }}>
              {searchQuery ? "Ничего не найдено" : "Напиши первым!"}
            </div>
          )}
          {filteredGroupMsgs.map((msg, i) => renderBubble(msg, i, true))}
          <div ref={endRef} />
        </div>
        {inputBar("Написать в форум...")}
      </div>
    );
  }

  // ── THREAD VIEW ──
  if (view === "thread" && peer) {
    const peerThread = messages.filter(msg => (msg.from === meId && msg.to === peer.id) || (msg.from === peer.id && msg.to === meId));
    const filteredThread = searchQuery
      ? peerThread.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : peerThread;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text }} {...swipe}>
        {contextMenuUI}
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => { setView("list"); setSearchQuery(""); setShowSearch(false); }} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0 }}>
            {String.fromCharCode(8592)} назад
          </button>
          <Avatar member={peer} size={34} />
          <div style={{ flex: 1 }}>
            <div onClick={() => onSelectMember?.(peer.id)} style={{ fontWeight: 600, fontSize: 14, color: T.accent, cursor: "pointer" }}>
              {peer.name} {String.fromCharCode(8594)}
            </div>
            <div style={{ fontSize: 11, color: T.text4 }}>{peer.profession || "участник"}</div>
          </div>
          <button onClick={() => setShowSearch(s => !s)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 16, padding: 0 }}>
            {String.fromCharCode(128269)}
          </button>
        </div>

        {showSearch && (
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${T.border}` }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по сообщениям..." autoFocus
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredThread.length === 0 && (
            <div style={{ textAlign: "center", color: T.text5, marginTop: 40, fontSize: 13 }}>
              {searchQuery ? "Ничего не найдено" : "Начни переписку!"}
            </div>
          )}
          {filteredThread.map((msg, i) => renderBubble(msg, i, false))}
          <div ref={endRef} />
        </div>
        {inputBar(`Написать ${peer.name.split(" ")[0]}...`)}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div style={{ animation: "fadeUp 0.25s ease", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif" }} {...swipe}>
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          {String.fromCharCode(8592)} назад
        </button>
        <div style={{ fontSize: 19, fontWeight: 700, flex: 1 }}>Сообщения</div>
        <button onClick={() => setShowSearch(s => !s)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 16, padding: 0 }}>
          {String.fromCharCode(128269)}
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding: "8px 20px" }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по сообщениям и контактам..." autoFocus
            style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>
      )}

      <div style={{ padding: "12px 20px" }}>
        {/* Group forum card */}
        <div onClick={() => setView("group")} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          background: "#6366f115", border: "1px solid #6366f130", borderRadius: 14, marginBottom: 14, cursor: "pointer"
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#6366f120"}
          onMouseLeave={e => e.currentTarget.style.background = "#6366f115"}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#6366f120", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
            {String.fromCharCode(127806)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#818cf8" }}>Общий форум</div>
            <div style={{ fontSize: 12, color: T.text4, marginTop: 1 }}>
              {groupMessages.length > 0
                ? groupMessages[groupMessages.length - 1].text.slice(0, 40) + "..."
                : `${members.length} участников`}
            </div>
          </div>
          {groupMessages.length > 0 && <div style={{ fontSize: 11, color: T.text5 }}>{groupMessages[groupMessages.length - 1].time}</div>}
        </div>

        {/* Quick access avatars */}
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

        {/* Conversation list */}
        {filteredConvs.length === 0 && !searchQuery && (
          <div style={{ textAlign: "center", color: T.text5, padding: "24px 0", fontSize: 13 }}>Нет переписок</div>
        )}
        {filteredConvs.length === 0 && searchQuery && (
          <div style={{ textAlign: "center", color: T.text5, padding: "24px 0", fontSize: 13 }}>Ничего не найдено</div>
        )}
        {filteredConvs.map(({ member: m, thread, last, unread }) => (
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
                  {last ? (last.deleted ? "Сообщение удалено" : (last.from === meId ? "Вы: " : "") + (last.attachment && !last.text ? "Файл" : last.text)) : "Нет сообщений"}
                </div>
              </div>
              {last && <div style={{ fontSize: 10, color: T.text5, flexShrink: 0 }}>{last.time}</div>}
            </div>
            <button onClick={() => onSelectMember?.(m.id)}
              style={{ background: "none", border: `1px solid ${T.border}`, color: T.text4, fontSize: 12, padding: "4px 8px", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}>
              {String.fromCharCode(128100)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
