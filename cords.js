// ============================================================================
// shared/cords.js — Cords, the app's direct/group messaging system: request/
// accept flow, the cord list and pending-invites view, the message thread
// (send/poll/render), avatar generation, and the "send this shared link into
// a Cord" piece of the app-wide Share Sheet.
//
// The Share Sheet itself (openShareSheet/closeShareSheet/copy-link/device-
// share) stayed in app.js — it's generic, used by every "shareX" function
// across every already-extracted module, not something exclusive to Cords.
// Only its one Cords-specific piece (renderShareSheetCordList,
// sendShareToCord) moved here; app.js's openShareSheet calls back into it.
// lastMainTabId (which cord/margins views return to on close) and
// closeMyMarginsView (which also uses it) stayed in app.js too, for the
// same reason -- both are genuinely shared navigation state, not Cords' own,
// despite sitting right next to Cords' own code in the original file.
//
// Depends on:
//   - core/db.js: cordMessagesTable, cordMembersTable, profilesTable
//   - supabaseClient directly, for one RPC call (respond_to_cord_invite /
//     create_cord) that doesn't go through a table accessor -- referenced
//     as a pre-existing global the same way core/db.js does, and safe for
//     the same reason (see that file's header comment).
//   - app.js: closeShareSheet, ensureLoggedInFor, escapeHtml,
//     linkifyMessageContent, logout, setHeaderIconSelected, switchTab,
//     currentUser, shareSheetContext, lastMainTabId
// app.js in turn imports this module's own exports back (openCordView,
// renderShareSheetCordList, etc.) — the same circular-dependency pattern
// used throughout this app, safe here for the same reason: every usage on
// both sides is inside a function body, never at module-load time.
// ============================================================================

import { cordMessagesTable, cordMembersTable, profilesTable } from '../core/db.js';
import {
  closeShareSheet, ensureLoggedInFor, escapeHtml, linkifyMessageContent, logout,
  setHeaderIconSelected, switchTab, currentUser, shareSheetContext, lastMainTabId
} from '../app.js';

    // ============================================================
    // CORDS SYSTEM (request/accept, direct + group cords)
    // ============================================================
    export let cordList = [];          // accepted cords, sorted by most recent activity
    export let cordPending = [];       // invites awaiting the current user's response
    export let cordNewUsernames = [];  // username chips being built for a new cord
    export let activeCordId = null;    // set = viewing that cord's message thread
    export let cordMessagesCache = [];
    export let cordPollTimer = null;

    // A setter, rather than letting app.js's switchTab() clear this directly —
    // an imported binding is a read-only view from the importing module's
    // side, so stopping the poll from outside this module has to go through
    // this instead.
    export function stopCordPollTimer() {
      if (cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
    }
    export let cordUsernameCache = {};

    // --- Avatar helpers (IG-style colored initial circles — no photo storage,
    // so every avatar is generated from the app's own existing palette). ---
    export const CORD_AVATAR_COLORS = ['var(--primary-color)', 'var(--accent-teal)', 'var(--accent-coral)', 'var(--accent-purple)', 'var(--accent-yellow)', 'var(--secondary-color)'];
    export function cordAvatarColor(seed) {
      const str = String(seed || '?');
      let hash = 0;
      for (let i = 0; i < str.length; i++) { hash = (hash * 31 + str.charCodeAt(i)) >>> 0; }
      return CORD_AVATAR_COLORS[hash % CORD_AVATAR_COLORS.length];
    }
    export function cordAvatarInitial(name) {
      const trimmed = (name || '').trim();
      return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
    }
    // seed should be something stable per-person (a user id) when available, so a
    // given person's avatar color doesn't shift if their display name changes.
    // An inline SVG (rather than the 👥 emoji) so the group icon is always a
    // solid white glyph on the avatar circle, no matter what platform this
    // renders on — an emoji's colors come from the OS's own emoji font and
    // ignore CSS color entirely, which is why it never matched the white
    // initials used for direct-cord avatars.
    export const CORD_GROUP_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:55%; height:55%;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

    export function cordAvatarHtml(name, seed, isGroup, size) {
      const px = size || 44;
      const bg = cordAvatarColor(seed || name);
      const content = isGroup ? CORD_GROUP_ICON_SVG : cordAvatarInitial(name);
      return `<div class="cord-avatar" style="background:${bg}; width:${px}px; height:${px}px; font-size:${Math.round(px * 0.42)}px;">${content}</div>`;
    }

    export function renderShareSheetCordList() {
      const listEl = document.getElementById('share-sheet-cord-list');
      if (!listEl) return;

      if (!currentUser) {
        listEl.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding:8px 0;">Sign in to send this in a Cord.</div>`;
        return;
      }

      if (cordList.length === 0) {
        listEl.innerHTML = `
          <div style="color:var(--text-muted); font-size:13px; padding:4px 0 12px;">You don't have any cords yet.</div>
          <button type="button" class="page-btn" style="width:100%;" onclick="closeShareSheet(); switchTab('bible'); openCordView();">Start a Cord</button>`;
        return;
      }

      listEl.innerHTML = `<div class="cord-section-label" style="margin-top:0;">Send in a Cord</div>` +
        cordList.map(c => `
          <div class="cord-list-item" onclick="sendShareToCord(${c.id})">
            ${cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 40)}
            <div class="cord-list-item-info">
              <span class="cord-list-item-name">${escapeHtml(c.name)}</span>
              <span class="cord-list-item-sub">${c.isGroup ? 'Group cord' : 'Direct cord'}</span>
            </div>
          </div>`).join('');
    }

    export async function sendShareToCord(cordId) {
      if (!shareSheetContext || !currentUser) return;
      const { url, label } = shareSheetContext;
      const content = `${label}\n${url}`;

      const { error } = await cordMessagesTable.insert({
        cord_id: cordId,
        sender_id: currentUser.id,
        content
      });

      if (error) {
        console.error('Error sending share to cord:', error.message);
        alert('Could not send: ' + error.message);
        return;
      }

      closeShareSheet();

      // If that cord's thread happens to already be open, refresh it so the
      // shared link shows up immediately instead of waiting for the next poll.
      if (activeCordId === cordId) { loadCordMessages().then(() => renderCordViewBody()); }
    }

    // Namespaced by user id (rather than one shared key) so this cache can
    // never be read back for the wrong account — belt-and-suspenders on top
    // of clearing it outright on logout (see logout()). Old shared-key data
    // from before this fix is simply never read under the new key and just
    // sits there inert; it's harmless.
    export function cordCacheStorageKey() {
      return currentUser && currentUser.id ? `cordDataCache_${currentUser.id}` : null;
    }

    export function saveCordCacheToStorage() {
      const key = cordCacheStorageKey();
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify({
          userId: currentUser.id,
          list: cordList,
          pending: cordPending,
          usernames: cordUsernameCache,
          ts: Date.now()
        }));
      } catch (e) {}
    }

    export function loadCordCacheFromStorage() {
      const key = cordCacheStorageKey();
      if (!key) return false;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        // Extra guard: never apply a cached payload that isn't this user's,
        // even if it somehow ended up under this key.
        if (!parsed || parsed.userId !== currentUser.id) return false;
        cordList = parsed.list || [];
        cordPending = parsed.pending || [];
        cordUsernameCache = Object.assign({}, parsed.usernames || {}, cordUsernameCache);
        return true;
      } catch (e) {
        return false;
      }
    }

    // Wipes every trace of the current session's Cords state — in-memory and
    // cached-to-disk — so nothing from this account can leak into whichever
    // account signs in next on this device. Called from logout().
    export function resetCordStateForLogout() {
      const key = cordCacheStorageKey();
      cordList = [];
      cordPending = [];
      cordNewUsernames = [];
      activeCordId = null;
      cordMessagesCache = [];
      cordUsernameCache = {};
      if (cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
      if (key) {
        try { localStorage.removeItem(key); } catch (e) {}
      }
      // So the next person to log in on this device doesn't briefly see this
      // account's unread count before their own cords ever load.
      const badgeEl = document.getElementById('cords-notification-badge');
      if (badgeEl) badgeEl.style.display = 'none';
      // This container stays in the DOM (just hidden) whenever Cords isn't the
      // active tab, so clear its actual message/list content too — otherwise
      // this account's cord list or an open thread's messages are still sitting
      // there for whoever reopens the tab next.
      const bodyEl = document.getElementById('cord-view-body');
      if (bodyEl) bodyEl.innerHTML = '';
    }

    export function openCordView() {
      if (!ensureLoggedInFor('Sign in to use Cords.', () => openCordView())) return;
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      setHeaderIconSelected('cords-header-btn');
      const notifPanel = document.getElementById('reading-notification-panel');
      if (notifPanel) notifPanel.style.display = 'none';

      document.getElementById('cord-view').classList.add('active');
      activeCordId = null;

      // Paint instantly from the last cached copy (if any) while a fresh copy loads
      // in the background — avoids a blank flash and an extra fetch on quick reopens.
      if (loadCordCacheFromStorage()) {
        renderCordViewBody();
      }
      loadCordData();

      if (!cordPollTimer) cordPollTimer = setInterval(() => {
        // While a thread is open, each poll's fresh messages are shown right
        // away, so re-mark that cord read too rather than letting a bubble
        // silently build up behind an already-open conversation.
        if (activeCordId) { loadCordMessages().then(() => {
          const latestMsg = cordMessagesCache.length > 0 ? cordMessagesCache[cordMessagesCache.length - 1].created_at : null;
          setCordLastRead(activeCordId, latestMsg);
          updateCordNotificationBadge();
          renderCordViewBody();
        }); }
        else { loadCordData(); }
      }, 15000);
    }

    export function closeCordView() {
      if (cordPollTimer) { clearInterval(cordPollTimer); cordPollTimer = null; }
      switchTab(lastMainTabId);
    }

    // Pass forceRefresh = true at the specific spots that actually render names
    // (the cord list, pending requests, an open thread's messages) so a display
    // name someone just changed in Settings shows up there — including on other
    // people's screens — the next time that list loads or the 15s Cords poll
    // ticks, rather than being stuck on whatever was cached the first time this
    // person's id was ever looked up.
    export async function resolveCordUsernames(ids, forceRefresh = false) {
      const uniqueIds = [...new Set(ids)].filter(id => id && (forceRefresh || !cordUsernameCache[id]));
      if (uniqueIds.length === 0) return;
      // Prefer each person's Cords display name (set from Settings); fall back to
      // their account username if they haven't set one.
      const { data, error } = await profilesTable.select('id, username, display_name').in('id', uniqueIds);
      if (!error && data) data.forEach(p => { cordUsernameCache[p.id] = p.display_name || p.username; });
    }

    export function formatCordDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // --- Cords header notification bubble ---
    // "Unread" is tracked as a last-read timestamp per cord, in localStorage
    // under the current user's id — same convention as every other "seen"
    // tracker in this app (getSeenRecordBadgeIds, getSeenStudyContentIds
    // above), rather than a new DB column, since all it needs to answer is
    // "how many messages came in since I last opened this cord on this
    // device." A cord with no recorded last-read time (never opened) counts
    // every message not sent by you as unread, same as a fresh inbox would.
    export function getCordLastReadMap() {
      if (!currentUser) return {};
      try {
        const raw = localStorage.getItem(`cordLastRead_${currentUser.id}`);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }

    // atIso lets a caller mark "read up through" the timestamp of the newest
    // message it actually just fetched, rather than "right now" — a hair
    // safer than the wall-clock in case this device's clock and the
    // database's are ever slightly out of step. Falls back to now when no
    // timestamp is given (e.g. there were no messages at all to read).
    export function setCordLastRead(cordId, atIso) {
      if (!currentUser) return;
      try {
        const map = getCordLastReadMap();
        map[cordId] = atIso || new Date().toISOString();
        localStorage.setItem(`cordLastRead_${currentUser.id}`, JSON.stringify(map));
      } catch (e) {}
    }

    // Fetches every message across all of the user's (accepted) cords in one
    // query, then counts — per cord — how many arrived after that cord was
    // last read and weren't sent by the user themselves (your own messages
    // never count as "unread" for you). Updates the header bubble with the
    // total across every cord. Call this any time cordList changes (login,
    // opening the Cords view, the background poll, accepting/starting a
    // cord) so the bubble stays accurate even if the user never opens Cords
    // this session.
    export async function updateCordNotificationBadge() {
      const badgeEl = document.getElementById('cords-notification-badge');
      if (!badgeEl) return;
      if (!currentUser || cordList.length === 0) { badgeEl.style.display = 'none'; return; }

      const cordIds = cordList.map(c => c.id);
      const { data, error } = await cordMessagesTable
        .select('cord_id, sender_id, created_at')
        .in('cord_id', cordIds);
      if (error) { console.error('Error loading cord messages for unread count:', error.message); return; }

      const lastRead = getCordLastReadMap();
      const unreadCount = (data || []).filter(m => {
        if (m.sender_id === currentUser.id) return false;
        const readAt = lastRead[m.cord_id];
        return !readAt || new Date(m.created_at) > new Date(readAt);
      }).length;

      if (unreadCount > 0) { badgeEl.innerText = unreadCount; badgeEl.style.display = 'flex'; }
      else badgeEl.style.display = 'none';
    }

    export async function loadCordData() {
      if (!currentUser) return;

      const { data: memberships, error } = await cordMembersTable
        .select('cord_id, status, cords(id, is_group, name, last_message_at, created_by)')
        .eq('user_id', currentUser.id);

      if (error) { console.error('Error loading cords:', error.message); return; }

      const accepted = (memberships || []).filter(m => m.status === 'accepted' && m.cords);
      const pending = (memberships || []).filter(m => m.status === 'pending' && m.cords);

      // Batch-fetch "the other member" for every direct (non-group) accepted cord in
      // ONE query instead of one round trip per cord — avoids an N+1 query pattern
      // that would otherwise scale with how many cords a user has.
      const directCordIds = accepted.filter(m => !m.cords.is_group).map(m => m.cords.id);
      let otherMemberByCord = {};
      if (directCordIds.length > 0) {
        const { data: otherRows, error: otherError } = await cordMembersTable
          .select('cord_id, user_id')
          .in('cord_id', directCordIds)
          .neq('user_id', currentUser.id);
        if (!otherError && otherRows) {
          otherRows.forEach(r => { otherMemberByCord[r.cord_id] = r.user_id; });
        }
      }
      await resolveCordUsernames(Object.values(otherMemberByCord), true);

      cordList = accepted.map(m => {
        let displayName = m.cords.name;
        const otherId = otherMemberByCord[m.cords.id];
        if (!m.cords.is_group) {
          displayName = otherId ? (cordUsernameCache[otherId] || 'Cord') : 'Cord';
        }
        // Avatar color is seeded from a stable id (the other person's user id for a
        // direct cord, the cord's own id for a group) rather than the display name,
        // so it doesn't shift colors when someone updates their name in Settings.
        return { id: m.cords.id, isGroup: m.cords.is_group, name: displayName, lastMessageAt: m.cords.last_message_at, avatarSeed: m.cords.is_group ? m.cords.id : otherId };
      });
      cordList.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

      await resolveCordUsernames(pending.filter(m => !m.cords.is_group).map(m => m.cords.created_by), true);
      cordPending = pending.map(m => ({
        id: m.cords.id,
        isGroup: m.cords.is_group,
        name: m.cords.is_group ? m.cords.name : (cordUsernameCache[m.cords.created_by] || 'Someone'),
        avatarSeed: m.cords.is_group ? m.cords.id : m.cords.created_by
      }));

      saveCordCacheToStorage();
      renderCordViewBody();
      updateCordNotificationBadge();
    }

    export function addCordUsernameChip() {
      const input = document.getElementById('cord-new-username-input');
      const val = input.value.trim();
      if (!val) return;
      if (!cordNewUsernames.includes(val)) cordNewUsernames.push(val);
      input.value = '';
      renderCordViewBody();
      const refocus = document.getElementById('cord-new-username-input');
      if (refocus) refocus.focus();
    }

    export function removeCordUsernameChip(index) {
      cordNewUsernames.splice(index, 1);
      renderCordViewBody();
    }

    export async function submitNewCord() {
      const statusEl = document.getElementById('cord-status-msg');
      if (cordNewUsernames.length === 0) {
        if (statusEl) statusEl.innerText = 'Add at least one username first.';
        return;
      }
      const groupNameInput = document.getElementById('cord-group-name-input');
      const groupName = groupNameInput ? groupNameInput.value.trim() : null;

      const { error } = await supabaseClient.rpc('create_cord', {
        p_usernames: cordNewUsernames,
        p_group_name: groupName || null
      });

      if (error) {
        console.error('Error creating cord:', error.message);
        if (statusEl) statusEl.innerText = error.message;
        return;
      }

      cordNewUsernames = [];
      loadCordData();
    }

    export async function respondToCord(cordId, accept) {
      const { error } = await supabaseClient.rpc('respond_to_cord_invite', { p_cord_id: cordId, p_accept: accept });
      if (error) { console.error('Error responding to cord:', error.message); return; }
      loadCordData();
    }

    export async function openCordThread(cordId) {
      activeCordId = cordId;
      await loadCordMessages();
      // Opening a thread is what "reading" it means here — clear its unread
      // count immediately rather than waiting for the next background poll.
      // Read "through" the newest message just fetched (falling back to now
      // for an empty thread) — see setCordLastRead's comment.
      const latestMsg = cordMessagesCache.length > 0 ? cordMessagesCache[cordMessagesCache.length - 1].created_at : null;
      setCordLastRead(cordId, latestMsg);
      updateCordNotificationBadge();
      renderCordViewBody();
    }

    export function backToCordList() {
      activeCordId = null;
      loadCordData();
    }

    export async function loadCordMessages() {
      if (!activeCordId) return;
      const { data, error } = await cordMessagesTable
        .select('*')
        .eq('cord_id', activeCordId)
        .order('created_at', { ascending: true });
      if (error) { console.error('Error loading cord messages:', error.message); return; }
      cordMessagesCache = data || [];
      await resolveCordUsernames(cordMessagesCache.map(m => m.sender_id), true);
    }

    export async function sendCordThreadMessage() {
      const input = document.getElementById('cord-thread-input');
      const text = input.value.trim();
      if (!text || !activeCordId) return;

      const { error } = await cordMessagesTable.insert({
        cord_id: activeCordId,
        sender_id: currentUser.id,
        content: text
      });
      if (error) { console.error('Error sending cord message:', error.message); return; }
      input.value = '';
      await loadCordMessages();
      renderCordViewBody();
    }

    export function renderCordViewBody() {
      const body = document.getElementById('cord-view-body');
      if (!body) return;

      if (activeCordId) {
        renderCordThread(body);
        return;
      }

      let html = `
        <div class="cord-compose-box">
          <div class="cord-section-label" style="margin-top:0;">New Cord</div>
          <div class="cord-search-row">
            <input type="text" id="cord-new-username-input" class="cord-search-input" placeholder="Enter Username/Display Name" onkeypress="if(event.key==='Enter'){event.preventDefault(); addCordUsernameChip();}">
            <button class="cord-add-circle-btn" title="Add" onclick="addCordUsernameChip()">+</button>
          </div>
          ${cordNewUsernames.length > 0 ? `<div class="cord-chip-row">${cordNewUsernames.map((u, i) => `<span class="cord-username-chip">${cordAvatarHtml(u, u, false, 18)}${u}<button onclick="removeCordUsernameChip(${i})">&times;</button></span>`).join('')}</div>` : ''}
          ${cordNewUsernames.length > 1 ? `<input type="text" id="cord-group-name-input" class="cord-search-input" style="margin-top:8px; width:100%;" placeholder="Group name">` : ''}
          ${cordNewUsernames.length > 0 ? `<button class="btn" style="width:100%; margin-top:10px;" onclick="submitNewCord()">Create Cord</button>` : ''}
          <div id="cord-status-msg" style="font-size:12px; color:var(--text-muted); margin-top:6px;"></div>
        </div>`;

      if (cordPending.length > 0) {
        html += `<div class="cord-section-label">Requests</div>`;
        cordPending.forEach(p => {
          html += `
            <div class="cord-pending-item">
              ${cordAvatarHtml(p.name, p.avatarSeed, p.isGroup, 44)}
              <div class="cord-pending-info">
                <span class="cord-pending-name">${p.name}</span>
                <span class="cord-pending-sub">${p.isGroup ? 'Group invite' : 'Wants to cord with you'}</span>
              </div>
              <span style="display:flex; gap:6px; flex-shrink:0;">
                <button class="cord-pill-btn cord-pill-btn-accept" onclick="respondToCord(${p.id}, true)">Accept</button>
                <button class="cord-pill-btn cord-pill-btn-decline" onclick="respondToCord(${p.id}, false)">Delete</button>
              </span>
            </div>`;
        });
      }

      html += `<div class="cord-section-label">Cords</div>`;
      if (cordList.length === 0) {
        html += `<div style="color:var(--text-muted); font-size:13px; padding:8px 4px;">No cords yet — search a username or display name above to start one.</div>`;
      } else {
        cordList.forEach(c => {
          html += `
            <div class="cord-list-item" onclick="openCordThread(${c.id})">
              ${cordAvatarHtml(c.name, c.avatarSeed, c.isGroup, 48)}
              <div class="cord-list-item-info">
                <span class="cord-list-item-name">${c.name}</span>
                <span class="cord-list-item-sub">${c.isGroup ? 'Group cord' : 'Direct cord'}</span>
              </div>
              <span class="cord-list-item-date">${formatCordDate(c.lastMessageAt)}</span>
            </div>`;
        });
      }

      body.innerHTML = html;
    }

    export function renderCordThread(body) {
      const cordInfo = cordList.find(c => c.id === activeCordId);
      const title = cordInfo ? cordInfo.name : 'Cord';
      const headerAvatar = cordInfo ? cordAvatarHtml(cordInfo.name, cordInfo.avatarSeed, cordInfo.isGroup, 34) : cordAvatarHtml('?', activeCordId, false, 34);

      let messagesHtml = cordMessagesCache.map((m, i) => {
        const isMe = m.sender_id === currentUser.id;
        const name = isMe ? 'You' : (cordUsernameCache[m.sender_id] || 'User');
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

        // IG-style grouping: only the OTHER person gets an avatar (never your own
        // sent bubbles), and only on the last bubble of a consecutive run from
        // them — earlier bubbles in that run get a blank spacer so they still
        // line up under it instead of hugging the edge.
        const next = cordMessagesCache[i + 1];
        const isLastInGroup = !next || next.sender_id !== m.sender_id;
        const otherAvatarHtml = isLastInGroup ? cordAvatarHtml(name, m.sender_id, false, 26) : `<div class="cord-msg-avatar-spacer"></div>`;
        const showNameLabel = !isMe && cordInfo && cordInfo.isGroup && isLastInGroup;

        return `
          <div class="cord-msg-row ${isMe ? 'me' : 'other'}">
            ${isMe ? '' : otherAvatarHtml}
            <div class="cord-thread-bubble ${isMe ? 'me' : 'other'}" style="background:${isMe ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : 'var(--bg-color)'}; color:${isMe ? '#fff' : 'var(--text-main)'};">
              ${showNameLabel ? `<div class="cord-thread-bubble-meta">${escapeHtml(name)}</div>` : ''}
              <div>${linkifyMessageContent(m.content)}</div>
            </div>
          </div>
          ${isLastInGroup ? `<div class="cord-msg-time ${isMe ? 'me' : 'other'}">${time}</div>` : ''}`;
      }).join('');

      if (!messagesHtml) {
        messagesHtml = `<div style="color:var(--text-muted); font-size:13px; text-align:center; padding:20px;">No messages yet — say hello!</div>`;
      }

      body.innerHTML = `
        <div class="cord-thread-header">
          <button class="cord-thread-back" onclick="backToCordList()" title="Back">&larr;</button>
          ${headerAvatar}
          <span class="cord-thread-title">${title}</span>
        </div>
        <div class="cord-messages-scroll" id="cord-messages-scroll">${messagesHtml}</div>
        <div class="cord-thread-sendbar">
          <input type="text" id="cord-thread-input" class="cord-thread-input-pill" placeholder="Message..." onkeypress="if(event.key==='Enter') sendCordThreadMessage()">
          <button class="cord-send-circle-btn" title="Send" onclick="sendCordThreadMessage()">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>`;

      const scrollEl = document.getElementById('cord-messages-scroll');
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }