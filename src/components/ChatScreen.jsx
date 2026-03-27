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
function renderMessageText(text, members, onSelectMember) {
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
        <span key={match.index} className="bubble-mention"
          onClick={(e) => { e.stopPropagation(); onSelectMember?.(member.id); }}>@{member.name.split(" ")[0]}</span>
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
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [editingMsg, setEditingMsg] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [attachment, setAttachment] = useState(null);
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
      const allMsgs = [...messages, ...groupMessages];
      const newest = allMsgs[allMsgs.length - 1];
      if (newest && newest.from !== meId) playNotifSound();
    }
    setPrevMsgCount(total);
  }, [messages.length, groupMessages.length]);

  const lastTypingRef = useRef(0);
  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    setText(val);

    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }

    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
    }
  }, []);

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

  const convs = members.filter(m => m.id !== meId).map(m => {
    const thread = messages.filter(msg => (msg.from === meId && msg.to === m.id) || (msg.from === m.id && msg.to === meId));
    const last = thread[thread.length - 1];
    const unread = thread.filter(msg => msg.to === meId && !msg.read).length;
    return { member: m, thread, last, unread };
  }).filter(c => c.thread.length > 0 || c.member.id === peer?.id)
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));

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

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, groupMessages.length, view]);

  // ── BUBBLE ──
  const renderBubble = (msg, i, isGroupView) => {
    const isMine = msg.from === meId;
    const sender = isGroupView ? members.find(m => m.id === msg.from) : null;

    if (msg.deleted) {
      return (
        <div key={msg.id || i} className={`bubble-wrap ${isMine ? "bubble-wrap-me" : "bubble-wrap-other"}`}>
          <div className="bubble-deleted">Сообщение удалено</div>
        </div>
      );
    }

    return (
      <div key={msg.id || i} className={`bubble-wrap ${isMine ? "bubble-wrap-me" : "bubble-wrap-other"}`}>
        {isGroupView && !isMine && (
          <div className="bubble-sender" onClick={() => onSelectMember?.(msg.from)}>
            {sender?.name?.split(" ")[0] || "?"}
          </div>
        )}
        <div
          className={`bubble ${isMine ? "bubble-me" : "bubble-other"}`}
          onContextMenu={(e) => handleContextMenu(e, msg)}
          onTouchStart={(e) => {
            if (msg.from !== meId || msg.deleted) return;
            const timer = setTimeout(() => handleContextMenu(e, msg), 500);
            e.currentTarget._longPress = timer;
          }}
          onTouchEnd={(e) => { clearTimeout(e.currentTarget._longPress); }}
          onTouchMove={(e) => { clearTimeout(e.currentTarget._longPress); }}
          style={{ cursor: msg.from === meId ? "context-menu" : "default" }}
        >
          {msg.attachment && (
            <div style={{ marginBottom: msg.text ? 6 : 0 }}>
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment) ? (
                <img src={msg.attachment} alt={msg.attachmentName || "photo"}
                  style={{ maxWidth: "100%", borderRadius: 10, cursor: "pointer", maxHeight: 200, objectFit: "cover" }}
                  onClick={(e) => { e.stopPropagation(); window.open(msg.attachment, "_blank"); }} />
              ) : (
                <a href={msg.attachment} target="_blank" rel="noopener noreferrer"
                  style={{ color: isMine ? "#c7d2fe" : "var(--color-purple)", fontSize: "var(--text-sm)", textDecoration: "underline" }}
                  onClick={(e) => e.stopPropagation()}>
                  {msg.attachmentName || "Файл"}
                </a>
              )}
            </div>
          )}
          {msg.text && (
            <div className="bubble-text">
              {renderMessageText(msg.text, members, onSelectMember)}
            </div>
          )}
          <div className={`bubble-time ${isMine ? "bubble-time-me" : "bubble-time-other"}`}>
            {msg.edited && <span style={{ marginRight: 4 }}>ред.</span>}
            {msg.time}
          </div>
        </div>
      </div>
    );
  };

  // ── CONTEXT MENU ──
  const contextMenuUI = contextMenu && (
    <div className="ctx-menu-overlay" onClick={() => setContextMenu(null)}>
      <div className="ctx-menu"
        style={{ top: Math.min(contextMenu.y, window.innerHeight - 100), left: Math.min(contextMenu.x, window.innerWidth - 140) }}
        onClick={(e) => e.stopPropagation()}>
        <button className="ctx-menu-item" onClick={() => startEdit(contextMenu.msg)}>Редактировать</button>
        <button className="ctx-menu-item ctx-menu-item-danger" onClick={() => handleDelete(contextMenu.msg)}>Удалить</button>
      </div>
    </div>
  );

  // ── MENTION POPUP ──
  const mentionPopup = mentionMembers.length > 0 && (
    <div className="mention-popup">
      {mentionMembers.map((m, i) => (
        <div key={m.id} className={`mention-item${i === mentionIdx ? " mention-item-active" : ""}`}
          onClick={() => insertMention(m)}>
          <Avatar member={m} size={28} />
          <div>
            <div className="mention-name">{m.name}</div>
            <div className="mention-role">{m.profession || "участник"}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // ── INPUT BAR ──
  const inputBar = (placeholder) => (
    <div className="chat-input-bar">
      {mentionPopup}
      {editingMsg && (
        <div className="chat-edit-banner">
          <span>Редактирование сообщения</span>
          <button className="back-btn" onClick={cancelEdit} style={{fontSize:16}}>×</button>
        </div>
      )}
      {attachment && (
        <div className="chat-attachment-preview">
          <span>{attachment.name}</span>
          <button className="back-btn" onClick={() => setAttachment(null)} style={{color:"var(--color-danger)",fontSize:14}}>×</button>
        </div>
      )}
      <div className="chat-input-row">
        <button className="chat-attach-btn" onClick={() => fileRef.current?.click()}>+</button>
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />
        <input ref={inputRef} value={text} onChange={handleTextChange}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { sendMsg(); e.preventDefault(); }
            if (e.key === "Escape" && editingMsg) cancelEdit();
            if (mentionMembers.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMembers.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
              if (e.key === "Tab" || e.key === "Enter") {
                if (mentionMembers[mentionIdx]) { e.preventDefault(); insertMention(mentionMembers[mentionIdx]); }
              }
            }
          }}
          className="chat-input" placeholder={placeholder} />
        <button className={`chat-send-btn${editingMsg ? " chat-send-edit" : ""}`}
          onClick={sendMsg}>{editingMsg ? "ok" : "↑"}</button>
      </div>
    </div>
  );

  // ── CHAT HEADER (reusable) ──
  const chatHeader = (onBackClick, avatar, name, sub, onNameClick) => (
    <div className="chat-header">
      <button className="back-btn" onClick={onBackClick}>← назад</button>
      {avatar}
      <div className="flex-1">
        <div className="chat-header-name" onClick={onNameClick}>{name}</div>
        <div className="chat-header-sub">{sub}</div>
      </div>
      <button className="chat-attach-btn" onClick={() => setShowSearch(s => !s)} style={{fontSize:16}}>🔍</button>
    </div>
  );

  // ── SEARCH BAR (reusable) ──
  const searchBar = showSearch && (
    <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--color-border)" }}>
      <input className="chat-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        placeholder="Поиск по сообщениям..." autoFocus style={{borderRadius:"var(--radius-md)"}} />
    </div>
  );

  // ── GROUP VIEW ──
  if (view === "group") {
    const filteredGroupMsgs = searchQuery
      ? groupMessages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : groupMessages;

    return (
      <div className="chat-layout" {...swipe}>
        {contextMenuUI}
        {chatHeader(
          () => { setView("list"); setSearchQuery(""); },
          <div className="conv-forum-icon" style={{width:36,height:36,fontSize:18}}>🌾</div>,
          "Общий форум",
          `${members.length} участников`
        )}
        {searchBar}
        <div className="chat-messages">
          {filteredGroupMsgs.length === 0 && (
            <div className="chat-empty">{searchQuery ? "Ничего не найдено" : "Напиши первым!"}</div>
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
      <div className="chat-layout" {...swipe}>
        {contextMenuUI}
        {chatHeader(
          () => { setView("list"); setSearchQuery(""); setShowSearch(false); },
          <Avatar member={peer} size={34} />,
          <>{peer.name} →</>,
          peer.profession || "участник",
          () => onSelectMember?.(peer.id)
        )}
        {searchBar}
        <div className="chat-messages">
          {filteredThread.length === 0 && (
            <div className="chat-empty">{searchQuery ? "Ничего не найдено" : "Начни переписку!"}</div>
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
    <div className="anim-fade-up" style={{minHeight:"100vh"}} {...swipe}>
      <div className="flex items-center gap-3" style={{padding:"18px 20px 0"}}>
        <button className="back-btn" onClick={onBack}>← назад</button>
        <div className="page-title flex-1">Сообщения</div>
        <button className="chat-attach-btn" onClick={() => setShowSearch(s => !s)} style={{fontSize:16}}>🔍</button>
      </div>

      {showSearch && (
        <div style={{ padding: "8px 20px" }}>
          <input className="chat-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по сообщениям и контактам..." autoFocus style={{borderRadius:"var(--radius-md)"}} />
        </div>
      )}

      <div className="page-section">
        {/* Group forum card */}
        <div className="conv-forum" onClick={() => setView("group")}>
          <div className="conv-forum-icon">🌾</div>
          <div className="flex-1">
            <div style={{fontWeight:600,fontSize:"var(--text-base)",color:"var(--color-purple)"}}>Общий форум</div>
            <div style={{fontSize:"var(--text-xs)",color:"var(--color-text-muted)",marginTop:1}}>
              {groupMessages.length > 0
                ? groupMessages[groupMessages.length - 1].text.slice(0, 40) + "..."
                : `${members.length} участников`}
            </div>
          </div>
          {groupMessages.length > 0 && <div className="conv-time">{groupMessages[groupMessages.length - 1].time}</div>}
        </div>

        {/* Quick access avatars */}
        <div style={{ marginBottom: 12 }}>
          <div className="section-label-sm">Личные сообщения</div>
          <div className="quick-avatars">
            {members.filter(m => m.id !== meId && !m.frozen).map(m => (
              <div key={m.id} className="quick-avatar-item"
                onClick={() => { setPeer(m); setView("thread"); }}>
                <Avatar member={m} size={40} />
                <div className="quick-avatar-name">{m.name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        {filteredConvs.length === 0 && <div className="empty">{searchQuery ? "Ничего не найдено" : "Нет переписок"}</div>}
        <div className="stagger">
          {filteredConvs.map(({ member: m, thread, last, unread }) => (
            <div key={m.id} className="conv-item">
              <div className="flex items-center gap-3 flex-1" style={{cursor:"pointer",minWidth:0}} onClick={() => openThread(m)}>
                <div className="conv-avatar-wrap">
                  <Avatar member={m} size={42} />
                  {unread > 0 && <div className="conv-unread">{unread}</div>}
                </div>
                <div className="flex-1" style={{minWidth:0}}>
                  <div className="conv-name">{m.name}</div>
                  <div className="conv-preview">
                    {last ? (last.deleted ? "Сообщение удалено" : (last.from === meId ? "Вы: " : "") + (last.attachment && !last.text ? "Файл" : last.text)) : "Нет сообщений"}
                  </div>
                </div>
                {last && <div className="conv-time">{last.time}</div>}
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => onSelectMember?.(m.id)}
                style={{padding:"4px 8px",fontSize:"var(--text-xs)"}}>👤</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
