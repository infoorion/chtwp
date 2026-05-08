import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Global Real-time Bus for Mocking
const sgramBus = new BroadcastChannel('sgram-realtime-v3');
let globalPresence = {};
let listeners = {
  sync: [],
  join: [],
  leave: [],
  postgres_changes: []
};

sgramBus.onmessage = (event) => {
  const { type, payload } = event.data;
  console.log(`[Bus] ${type} received:`, payload);

  if (type === 'presence') {
    globalPresence = { ...globalPresence, ...payload };
    listeners.sync.forEach(cb => cb());
  } else if (type === 'request_sync') {
    sgramBus.postMessage({ type: 'presence', payload: globalPresence });
  } else if (type === 'message') {
    listeners.postgres_changes.forEach(cb => cb({ new: payload }));
  }
};

// Request initial state
setTimeout(() => sgramBus.postMessage({ type: 'request_sync' }), 500);

const mockSupabase = {
  channel: (name) => {
    return {
      on: (type, config, callback) => {
        const eventType = config?.event || type;
        const cb = callback || config;
        
        if (type === 'presence') {
          if (eventType === 'sync') listeners.sync.push(cb);
          if (eventType === 'join') listeners.join.push(cb);
          if (eventType === 'leave') listeners.leave.push(cb);
        } else if (type === 'postgres_changes') {
          listeners.postgres_changes.push((msg) => cb({ new: msg }));
        }
        return mockSupabase.channel(name);
      },
      subscribe: (cb) => {
        if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
        return mockSupabase.channel(name);
      },
      track: (data) => {
        console.log(`[Mock] Tracking:`, data.username);
        globalPresence[data.id] = [data];
        sgramBus.postMessage({ type: 'presence', payload: globalPresence });
        listeners.sync.forEach(cb => cb());
        // For mock simplicity, we don't trigger join/leave here as sync is enough for the UI
        return Promise.resolve();
      },
      presenceState: () => globalPresence,
      unsubscribe: () => {
        listeners = { sync: [], join: [], leave: [], postgres_changes: [] };
      }
    };
  },
  from: (table) => ({
    select: () => ({ order: () => ({ data: [], error: null }), or: () => ({ order: () => ({ data: [], error: null }) }) }),
    insert: (data) => {
      sgramBus.postMessage({ type: 'message', payload: data[0] });
      return Promise.resolve({ error: null });
    }
  }),
  storage: { from: () => ({ upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  removeChannel: (chan) => chan?.unsubscribe?.(),
  supabaseUrl: 'MOCK_URL'
};

export const supabase = (supabaseUrl && supabaseUrl !== 'your_project_url') 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : mockSupabase;
