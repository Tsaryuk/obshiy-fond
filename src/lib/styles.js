export const GCSS = `
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
