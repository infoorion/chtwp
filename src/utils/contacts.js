// Local-first contacts manager
// Stores chat partners directly in the browser — works even if the server resets

const KEY = (userId) => `sgram_contacts_${userId}`;

export const saveContact = (myId, partner) => {
  if (!myId || !partner?.id) return;
  const existing = getContacts(myId);
  const filtered = existing.filter(c => String(c.id) !== String(partner.id));
  const updated = [{ ...partner, id: String(partner.id) }, ...filtered];
  localStorage.setItem(KEY(myId), JSON.stringify(updated));
};

export const updateLastMessage = (myId, partnerId, message) => {
  if (!myId || !partnerId) return;
  const existing = getContacts(myId);
  const updated = existing.map(c =>
    String(c.id) === String(partnerId) ? { ...c, lastMessage: message } : c
  );
  localStorage.setItem(KEY(myId), JSON.stringify(updated));
};

export const getContacts = (myId) => {
  if (!myId) return [];
  const raw = localStorage.getItem(KEY(myId));
  return raw ? JSON.parse(raw) : [];
};
