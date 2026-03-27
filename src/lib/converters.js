export const toMember = (r) => r ? ({
  id: r.id, name: r.name, profession: r.profession || "", bio: r.bio || "",
  photo: r.photo || null, telegram: r.telegram || null, instagram: r.instagram || null,
  joined: r.joined || "2025-03", invitedBy: r.invited_by || null,
  systemRole: r.system_role || "member", frozen: r.frozen || false,
  helpful: r.helpful || "", avatar: (r.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
}) : null;

export const toOffer = (r) => r ? ({
  id: r.id, member: r.member, title: r.title, category: r.category || "Услуги",
  price: Number(r.price) || 0, unit: r.unit || "раз", qty: Number(r.qty) || 1,
  reserved: Number(r.reserved) || 0, available: r.available !== false,
  desc: r.description || "", photo: r.photo || null,
}) : null;

export const toRequest = (r, bids = []) => r ? ({
  id: r.id, member: r.member, title: r.title, category: r.category || "Все",
  desc: r.description || "", budget: r.budget ? Number(r.budget) : null,
  status: r.status || "open", acceptedBidId: r.accepted_bid_id || null,
  bids: bids.filter(b => b.request_id === r.id).map(toMBid),
}) : null;

export const toMBid = (b) => b ? ({
  id: b.id, from: b.from_member, price: Number(b.price) || 0,
  note: b.note || "", status: b.status || "pending",
}) : null;

export const toTx = (r) => r ? ({
  id: r.id, type: r.type, from: r.from_member, to: r.to_member,
  amount: Number(r.amount) || 0, qty: Number(r.qty) || 1, what: r.what || "",
  date: r.date || r.created_at || "", status: r.status || "pending",
  offerId: r.offer_id || null, reqId: r.req_id || null,
}) : null;

export const toReview = (r) => r ? ({
  id: r.id, txId: r.tx_id, from: r.from_member, to: r.to_member,
  stars: r.stars, text: r.body || "", date: r.date || "",
}) : null;

export const toMsg = (r) => r ? ({
  id: r.id, from: r.from_member, to: r.to_member,
  text: r.body || "", time: r.date || "", isGroup: r.is_group || false, read: r.read || false,
  edited: r.edited || false, deleted: r.deleted || false,
  attachment: r.attachment || null, attachmentName: r.attachment_name || null,
  ts: r.created_ts || 0,
}) : null;

export const toNotif = (r) => r ? ({
  id: r.id, memberId: r.member_id, type: r.type,
  text: r.body || "", date: r.date || "", read: r.read || false,
}) : null;

export const toInvite = (r) => r ? ({
  id: r.id, code: r.code, createdBy: r.created_by,
  usedBy: r.used_by || null, usedAt: r.used_at || null, createdAt: r.created_at || "",
}) : null;
