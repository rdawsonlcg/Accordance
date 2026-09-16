// ============================================================================
// shared/churchResources.js — Church Resources: pastoral/study resources
// attached to one or more Bible verses (shown inline in the main Bible
// reading view's Note column) or browsed by book under the "Line Upon Line"
// study sub-tab. Covers the CRUD flow (add/edit/remove, both entry points),
// thumbnail resolution, reference-text parsing, the Line Upon Line book
// browser and search, and the shared full-screen-video entry point.
//
// This was the most fragmented extraction of all of them — unlike the study
// features, Church Resources isn't one or two big movable chunks. It's
// woven into core, unrelated functions throughout app.js: the main verse-row
// template embeds its "add a resource" form directly inline (not a separate
// function — nothing to extract there, so it stays exactly where it is),
// loadBibleData() merges church_resources rows into the same fetch that
// loads Bible verses, the live-sync poller checks whether an edit form here
// is open before it dares re-render, and sign-out cleanup resets its admin
// form. All of those stayed in app.js and now import from here instead.
//
// Depends on:
//   - shared/videoPlayer.js: getYouTubeVideoId, getYouTubeThumbnailUrl,
//     isDirectImageUrl, openFsvPlayer
//   - app.js: escapeHtml, currentUser, currentBibleVerses,
//     BIBLE_STUDIES_BOOK_ORDER, shareResource, markStudySubTabSeen,
//     updateStudyNotificationBadges
// app.js in turn imports this module's own exports back — the same
// circular-dependency pattern used throughout this app, safe here for the
// same reason: every usage on both sides is inside a function body, never
// at module-load time.
//
// A real bug, caught and fixed before it could bite: this module's own
// reference-matching regex (used to validate a typed "Reference" field) used
// to be built eagerly, as a eager top-level IIFE, from BIBLE_STUDIES_BOOK_ORDER
// — an imported, circularly-dependent binding. That's the exact pattern that
// broke shared/coreD.js's scripture regex (caught there by a test that
// actually exercised it, not by a successful build). Fixed proactively here
// by computing it lazily on first real use instead, the same way.
// ============================================================================

import { churchResourcesTable } from '../core/db.js';
import { getYouTubeVideoId, getYouTubeThumbnailUrl, isDirectImageUrl, openFsvPlayer } from './videoPlayer.js';
import {
  escapeHtml, currentUser, currentBibleVerses, BIBLE_STUDIES_BOOK_ORDER,
  shareResource, markStudySubTabSeen, updateStudyNotificationBadges
} from '../app.js';



    export let churchResourcesMap = {}; // Will now hold Arrays of resources per rowIndex

    // DB id of the Church Resource currently open for editing (admins only), or null
    // when nothing is being edited. A resource can render in two places at once — its
    // verse's Church Resources column in the Note view, and its book's list under
    // Line Upon Line — so this is checked by both renderers (see
    // renderChurchResourceEditFormHtml) rather than tracked per-view.
    export let editingChurchResourceId = null;

    // A Church Resource's `reference` column can name more than one verse at once
    // (e.g. "Genesis 1:1, John 3:16") so a single resource can be tied to multiple
    // scriptures — no schema change needed, since it was already a free-text
    // column; this just splits it back apart for grouping. Order doesn't matter
    // here since every caller re-groups by target reference anyway.
    export function parseChurchResourceReferenceList(referenceField) {
      return (referenceField || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    // Shared insert path for a brand-new Church Resource, used by both the Note
    // view's per-verse "add a resource" form (addChurchResource, below) and the
    // Line Upon Line "Add Resource" form (addLineUponLineResource) — whichever
    // verse(s) the resource ultimately belongs to, it's saved and wired into local
    // state/the DOM exactly the same way. `targetVerses` is one or more resolved
    // verse objects (each with its own .rowIndex/.reference) — a single resource
    // can be tied to multiple scriptures at once, stored as one church_resources
    // row whose `reference` column holds every target reference, comma-separated
    // (see parseChurchResourceReferenceList). Returns true on success (state and
    // the affected views are already refreshed); false if the insert itself failed
    // (the error is already alert()ed here, matching every other save error in
    // this file, so the caller just needs to stop and leave the form as-is).
    export async function saveNewChurchResource(targetVerses, fields) {
      const referenceField = targetVerses.map(v => v.reference).join(', ');
      const { data, error } = await churchResourcesTable.insert(
        { reference: referenceField, title: fields.title, url: fields.url, type: fields.type, tags: fields.tags, notes: fields.notes, thumbnail_url: fields.thumbnail, thumbnail_hidden: fields.thumbnailHidden },
        'id'
      );

      if (error) {
        console.error('Error saving resource:', error.message);
        alert('Could not save resource: ' + error.message);
        return false;
      }

      // One shared item object, pushed into every target verse's local lists, so
      // a later edit (which mutates this same object by id) or delete (which
      // removes it by id from everywhere) instantly stays consistent across all
      // of this resource's verses without needing a full reload.
      const newItem = { id: data.id, resource: fields.url, title: fields.title, type: fields.type, tags: fields.tags, notes: fields.notes, thumbnail: fields.thumbnail, thumbnailHidden: fields.thumbnailHidden };

      targetVerses.forEach(tv => {
        // churchResourcesMap[rowIndex] and its verse's own .resources array are
        // often already the very same array object (renderVerses aliases them —
        // see line ~3465), since the currently-open chapter renders on boot. Push
        // into whichever one already exists as the single source of truth, then
        // point the other at it too — pushing into both independently, when
        // they're already the same array, would silently double-add this item.
        const verseObj = currentBibleVerses.find(v => v.rowIndex === tv.rowIndex);
        const targetList = (verseObj && verseObj.resources) || churchResourcesMap[tv.rowIndex] || [];
        targetList.push(newItem);
        if (verseObj) verseObj.resources = targetList;
        churchResourcesMap[tv.rowIndex] = targetList;

        updateChurchResourcesDOM(tv.rowIndex, tv.reference);
      });

      renderResourcesTab();
      updateStudyNotificationBadges();
      return true;
    }

    export async function addChurchResource(rowIndex, verseRef) {
      if (!currentUser || !currentUser.isAdmin) return;
      const inputTitle = document.getElementById(`church-title-input-${rowIndex}`);
      const inputRes = document.getElementById(`church-resource-input-${rowIndex}`);
      const inputType = document.getElementById(`church-type-input-${rowIndex}`);
      const inputTags = document.getElementById(`church-tags-input-${rowIndex}`);
      const inputNotes = document.getElementById(`church-notes-input-${rowIndex}`);
      const inputThumbnail = document.getElementById(`church-thumbnail-input-${rowIndex}`);
      const inputHideThumbnail = document.getElementById(`church-hide-thumbnail-input-${rowIndex}`);
      const inputReference = document.getElementById(`church-reference-input-${rowIndex}`);
      if (!inputRes) return;

      // The reference field auto-fills with this row's own verse (see renderVerses)
      // but stays editable — resolved/validated the same way the Line Upon Line
      // form does, so an admin who changes it still only ever saves against verses
      // that actually exist, wherever that ends up being. It also accepts more than
      // one reference, comma-separated, to tie this single resource to multiple
      // scriptures at once.
      const typedRef = inputReference ? inputReference.value.trim() : verseRef;
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = inputTitle ? inputTitle.value.trim() : '';
      const resourceText = inputRes.value.trim();
      const typeText = inputType ? inputType.value.trim() : '';
      const tagsText = inputTags ? inputTags.value.trim() : '';
      const notesText = inputNotes ? inputNotes.value.trim() : '';
      const thumbnailText = inputThumbnail ? inputThumbnail.value.trim() : '';
      const hideThumbnail = inputHideThumbnail ? inputHideThumbnail.checked : false;

      const saved = await saveNewChurchResource(targetVerses, {
        title: titleText, url: resourceText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail
      });
      if (!saved) return;

      if(inputTitle) inputTitle.value = '';
      if(inputRes) inputRes.value = '';
      if(inputType) inputType.value = '';
      if(inputTags) inputTags.value = '';
      if(inputNotes) inputNotes.value = '';
      if(inputThumbnail) inputThumbnail.value = '';
      if(inputHideThumbnail) inputHideThumbnail.checked = false;
      // Snap the reference field back to this row's own verse (rather than leaving
      // whatever the admin may have changed it to) so the form reads correctly the
      // next time they use it.
      if(inputReference) { inputReference.value = verseRef; inputReference.dataset.defaultRef = verseRef; }
    }

    // --- LINE UPON LINE "ADD RESOURCE" FORM (admin-only) ---
    // Unlike the Note view's per-verse form, there's no implicit "current verse"
    // here — the typed Reference field is the only way a new resource gets tied to
    // a verse, and it's what makes that resource show up automatically in the Note
    // view's Church Resources column for that verse (they're the same underlying
    // church_resources row, just displayed in two places based on its reference).
    export function toggleLineUponLineAddForm() {
      const form = document.getElementById('line-upon-line-add-form');
      if (!form) return;
      const opening = form.style.display === 'none';
      form.style.display = opening ? 'flex' : 'none';
      if (opening) {
        const refInput = document.getElementById('lul-add-reference-input');
        if (refInput) refInput.focus();
      }
    }

    export function clearLineUponLineAddFormFields() {
      ['lul-add-reference-input', 'lul-add-title-input', 'lul-add-url-input', 'lul-add-type-input', 'lul-add-tags-input', 'lul-add-notes-input', 'lul-add-thumbnail-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const hideCb = document.getElementById('lul-add-hide-thumbnail-input');
      if (hideCb) hideCb.checked = false;
    }

    export function cancelLineUponLineAddForm() {
      clearLineUponLineAddFormFields();
      const form = document.getElementById('line-upon-line-add-form');
      if (form) form.style.display = 'none';
    }

    export async function addLineUponLineResource() {
      if (!currentUser || !currentUser.isAdmin) return;
      const refInput = document.getElementById('lul-add-reference-input');
      const typedRef = refInput ? refInput.value.trim() : '';
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = (document.getElementById('lul-add-title-input')?.value || '').trim();
      const urlText = (document.getElementById('lul-add-url-input')?.value || '').trim();
      const typeText = (document.getElementById('lul-add-type-input')?.value || '').trim();
      const tagsText = (document.getElementById('lul-add-tags-input')?.value || '').trim();
      const notesText = (document.getElementById('lul-add-notes-input')?.value || '').trim();
      const thumbnailText = (document.getElementById('lul-add-thumbnail-input')?.value || '').trim();
      const hideThumbnail = document.getElementById('lul-add-hide-thumbnail-input')?.checked || false;

      // Jump straight to the book the FIRST target verse belongs to, so the render
      // triggered by saveNewChurchResource() below already shows it — otherwise
      // the admin would have to go hunting for it in the OT/NT lists. (It'll also
      // be visible under any other named verses' books, just not auto-opened there.)
      const firstRef = targetVerses[0].reference;
      const lastSpace = firstRef.lastIndexOf(' ');
      activeLineUponLineBook = lastSpace !== -1 ? firstRef.substring(0, lastSpace) : firstRef;

      const saved = await saveNewChurchResource(targetVerses, {
        title: titleText, url: urlText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail
      });
      if (!saved) return;

      cancelLineUponLineAddForm();
    }

    // Removes a resource's id from every local list that might hold it — not just
    // one verse's — since a single resource can be tied to multiple scriptures at
    // once (see saveNewChurchResource) and its underlying church_resources row is
    // deleted just once. Mutates arrays in place (splice) rather than reassigning,
    // since churchResourcesMap[rowIndex] and its verse's .resources are often the
    // very same array object (see renderVerses) and reassigning one would silently
    // desync it from the other.
    // Removes a resource's id from just ONE rowIndex's local lists (its
    // churchResourcesMap entry and its verse's own .resources array) — used when
    // editing a resource's Reference field drops one of its previously-tied
    // verses, as distinct from removeChurchResourceEverywhere's full removal on
    // delete (below).
    export function removeChurchResourceFromRowIndex(rowIndex, id) {
      const list = churchResourcesMap[rowIndex];
      if (list) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === id) list.splice(i, 1);
        }
      }
      const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
      if (verseObj && verseObj.resources) {
        for (let i = verseObj.resources.length - 1; i >= 0; i--) {
          if (verseObj.resources[i].id === id) verseObj.resources.splice(i, 1);
        }
      }
    }

    export function removeChurchResourceEverywhere(id) {
      if (currentBibleVerses) {
        currentBibleVerses.forEach(v => {
          if (!v.resources || v.resources.length === 0) return;
          for (let i = v.resources.length - 1; i >= 0; i--) {
            if (v.resources[i].id === id) v.resources.splice(i, 1);
          }
        });
      }
      Object.keys(churchResourcesMap).forEach(ri => {
        const list = churchResourcesMap[ri];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].id === id) list.splice(i, 1);
        }
      });
    }

    export async function removeChurchResourceItem(rowIndex, verseRef, resIdx) {
      if (!currentUser || !currentUser.isAdmin) return;

      const resList = churchResourcesMap[rowIndex];
      if (!resList || !resList[resIdx]) return;

      const item = resList[resIdx];

      if (item.id != null) {
        const { error } = await churchResourcesTable.remove(item.id);
        if (error) {
          console.error('Error deleting resource:', error.message);
          alert('Could not delete resource: ' + error.message);
          return;
        }

        // Find every rowIndex currently displaying this resource (it may be tied to
        // more than just this one verse) BEFORE removing it, so each of those
        // Note-view columns can be refreshed too — otherwise any of them other than
        // the one the delete was clicked from would keep showing it until the next
        // live-sync poll quietly caught up.
        const affectedRowIndexes = new Set();
        Object.keys(churchResourcesMap).forEach(ri => {
          if ((churchResourcesMap[ri] || []).some(r => r.id === item.id)) affectedRowIndexes.add(Number(ri));
        });

        removeChurchResourceEverywhere(item.id);

        affectedRowIndexes.forEach(ri => {
          const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
          updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
        });
      } else {
        // No DB id (shouldn't normally happen) — just drop this one local copy.
        resList.splice(resIdx, 1);
        const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
        if (verseObj && verseObj.resources) {
          const idx2 = verseObj.resources.indexOf(item);
          if (idx2 !== -1) verseObj.resources.splice(idx2, 1);
        }
        updateChurchResourcesDOM(rowIndex, verseRef);
      }

      renderResourcesTab();
      updateStudyNotificationBadges();
    }

    // Every verse reference a resource is CURRENTLY tied to, as a single
    // comma-separated string ready to drop straight into the edit form's
    // Reference field — derived from local state (no separate reference column
    // is cached on the item object itself) by finding every verse whose
    // .resources array contains this id. Order follows currentBibleVerses'
    // own (canonical, book-then-chapter-then-verse) order.
    export function getChurchResourceReferenceList(id) {
      if (!currentBibleVerses) return '';
      return currentBibleVerses
        .filter(v => (v.resources || []).some(r => r.id === id))
        .map(v => v.reference)
        .join(', ');
    }

    // --- EDITING AN EXISTING CHURCH RESOURCE (admins only) ---
    // A resource can be showing in two places at once — its verse's Church Resources
    // column in the Note view, and its book's expanded list under Line Upon Line — so
    // editing is tracked by the resource's own DB id (editingChurchResourceId) rather
    // than by which view opened it, and both views re-render together on every step.
    // `contextPrefix` ('note' or 'lul') just keeps the two views' input element ids
    // from colliding if the same resource happens to be open for editing in both at
    // once (its Note-view verse open, and its book expanded in Line Upon Line).
    export function renderChurchResourceEditFormHtml(r, contextPrefix, rowIndex, verseRef) {
      const idAttr = `${contextPrefix}-${r.id}`;
      const safeVerseRef = (verseRef || '').replace(/'/g, "\\'");
      const esc = (s) => (s || '').replace(/"/g, '&quot;');
      return `
        <div class="church-resource-input-container" style="flex-direction: column; gap: 4px;">
          <input type="text" id="church-edit-reference-${idAttr}" placeholder="Reference(s), e.g. Genesis 1:1, John 3:16..." style="width: 100%;" value="${esc(getChurchResourceReferenceList(r.id))}">
          <input type="text" id="church-edit-title-${idAttr}" placeholder="Title (visible title)..." style="width: 100%;" value="${esc(r.title)}">
          <input type="text" id="church-edit-url-${idAttr}" placeholder="URL..." style="width: 100%;" value="${esc(r.resource)}">
          <input type="text" id="church-edit-type-${idAttr}" placeholder="Type..." style="width: 100%;" value="${esc(r.type)}">
          <input type="text" id="church-edit-tags-${idAttr}" placeholder="Tags (e.g. Grace, Faith)..." style="width: 100%;" value="${esc(r.tags)}">
          <textarea id="church-edit-notes-${idAttr}" placeholder="Notes..." style="width: 100%; min-height: 40px; padding: 6px 10px; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid var(--border-color); border-radius: var(--border-radius); resize: vertical;">${(r.notes || '')}</textarea>
          <input type="text" id="church-edit-thumbnail-${idAttr}" placeholder="Custom thumbnail URL (optional)..." style="width: 100%;" value="${esc(r.thumbnail)}">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer; font-weight:normal;">
            <input type="checkbox" class="plan-checkbox" id="church-edit-hide-thumbnail-${idAttr}" ${r.thumbnailHidden ? 'checked' : ''}>Hide thumbnail
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 2px;">
            <button class="page-btn" onclick="cancelEditChurchResource(${rowIndex}, '${safeVerseRef}')">Cancel</button>
            <button class="btn" style="width: auto; padding: 6px 14px; font-size: 13px;" onclick="saveEditChurchResource(${r.id}, ${rowIndex}, '${safeVerseRef}', '${contextPrefix}')">Save</button>
          </div>
        </div>`;
    }

    export function startEditChurchResource(id, rowIndex, verseRef) {
      if (!currentUser || !currentUser.isAdmin) return;
      editingChurchResourceId = id;
      updateChurchResourcesDOM(rowIndex, verseRef);
      renderResourcesTab();
    }

    export function cancelEditChurchResource(rowIndex, verseRef) {
      editingChurchResourceId = null;
      updateChurchResourcesDOM(rowIndex, verseRef);
      renderResourcesTab();
    }

    export async function saveEditChurchResource(id, rowIndex, verseRef, contextPrefix) {
      if (!currentUser || !currentUser.isAdmin) return;
      const idAttr = `${contextPrefix}-${id}`;
      const inputReference = document.getElementById(`church-edit-reference-${idAttr}`);
      const inputTitle = document.getElementById(`church-edit-title-${idAttr}`);
      const inputUrl = document.getElementById(`church-edit-url-${idAttr}`);
      const inputType = document.getElementById(`church-edit-type-${idAttr}`);
      const inputTags = document.getElementById(`church-edit-tags-${idAttr}`);
      const inputNotes = document.getElementById(`church-edit-notes-${idAttr}`);
      const inputThumbnail = document.getElementById(`church-edit-thumbnail-${idAttr}`);
      const inputHideThumbnail = document.getElementById(`church-edit-hide-thumbnail-${idAttr}`);
      if (!inputUrl) return;

      // Validated/resolved exactly like the add forms — one or more comma-separated
      // full references, every one of which has to resolve to a real verse or the
      // whole save is blocked (no partial re-tie).
      const typedRef = inputReference ? inputReference.value.trim() : '';
      const { verses: targetVerses, invalid } = resolveChurchResourceReferenceList(typedRef);
      if (!targetVerses) {
        const bad = invalid.length > 0 ? invalid.map(x => `"${x}"`).join(', ') : `"${typedRef}"`;
        alert(`${bad} isn't a recognized verse reference. Use the full book name and an exact chapter:verse, e.g. "Genesis 1:1" (separate multiple references with commas).`);
        return;
      }

      const titleText = inputTitle ? inputTitle.value.trim() : '';
      const urlText = inputUrl.value.trim();
      const typeText = inputType ? inputType.value.trim() : '';
      const tagsText = inputTags ? inputTags.value.trim() : '';
      const notesText = inputNotes ? inputNotes.value.trim() : '';
      const thumbnailText = inputThumbnail ? inputThumbnail.value.trim() : '';
      const hideThumbnail = inputHideThumbnail ? inputHideThumbnail.checked : false;
      const referenceField = targetVerses.map(v => v.reference).join(', ');

      const { error } = await churchResourcesTable.update(
        id,
        { reference: referenceField, title: titleText, url: urlText, type: typeText, tags: tagsText, notes: notesText, thumbnail_url: thumbnailText, thumbnail_hidden: hideThumbnail }
      );

      if (error) {
        console.error('Error updating resource:', error.message);
        alert('Could not update resource: ' + error.message);
        return;
      }

      // Which rowIndexes currently hold this resource, BEFORE touching anything —
      // needed both to update its plain fields wherever it already lives, and to
      // work out which of those verses the new Reference field just dropped.
      // Checked against BOTH churchResourcesMap AND each verse's own .resources —
      // a verse whose Note-view row has never been rendered yet only has the tie
      // recorded on its .resources array (churchResourcesMap only gets a rowIndex
      // entry once that row is actually rendered — see renderVerses). Missing
      // either source here is exactly what would cause a resource to duplicate
      // itself: a verse that already holds it via .resources, but isn't yet
      // reflected in churchResourcesMap, would look "new" below and get a second
      // copy pushed in alongside the one already there.
      const oldRowIndexes = new Set();
      currentBibleVerses.forEach(v => {
        if ((v.resources || []).some(r => r.id === id)) oldRowIndexes.add(v.rowIndex);
      });
      Object.keys(churchResourcesMap).forEach(ri => {
        if ((churchResourcesMap[ri] || []).some(r => r.id === id)) oldRowIndexes.add(Number(ri));
      });

      // Update every existing local copy's plain fields (mutates the one object
      // shared across every verse it's tied to, so this alone keeps all of them in
      // sync — reference membership is handled separately below). Checked against
      // both churchResourcesMap and the verse's own .resources per rowIndex, in
      // case the two haven't been aliased to the same array yet.
      let sharedItem = null;
      const applyFieldUpdate = (list) => {
        const item = (list || []).find(r => r.id === id);
        if (item) {
          item.title = titleText; item.resource = urlText; item.type = typeText; item.tags = tagsText; item.notes = notesText; item.thumbnail = thumbnailText; item.thumbnailHidden = hideThumbnail;
          sharedItem = item;
        }
      };
      oldRowIndexes.forEach(ri => {
        applyFieldUpdate(churchResourcesMap[ri]);
        const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
        if (v) applyFieldUpdate(v.resources);
      });
      if (!sharedItem) {
        // Wasn't showing anywhere locally yet (shouldn't normally happen) — build a
        // fresh item object so it can still be attached to its new verse(s) below.
        sharedItem = { id, resource: urlText, title: titleText, type: typeText, tags: tagsText, notes: notesText, thumbnail: thumbnailText, thumbnailHidden: hideThumbnail };
      }

      // Reconcile WHICH verses hold it: drop it from any verse the edited
      // Reference field no longer names, and attach it to any newly-named verse
      // that didn't already have it. Verses present in both sets are untouched
      // (their copy was already updated above).
      const newRowIndexes = new Set(targetVerses.map(v => v.rowIndex));
      const affectedRowIndexes = new Set([...oldRowIndexes, ...newRowIndexes]);

      oldRowIndexes.forEach(ri => {
        if (!newRowIndexes.has(ri)) removeChurchResourceFromRowIndex(ri, id);
      });
      targetVerses.forEach(tv => {
        const verseObj = currentBibleVerses.find(v => v.rowIndex === tv.rowIndex);
        // Re-check actual presence here (not just membership in the oldRowIndexes
        // set computed above) as a last line of defense against ever pushing a
        // second copy of this resource into a verse that already has it.
        const alreadyPresent = (verseObj && (verseObj.resources || []).some(r => r.id === id)) || (churchResourcesMap[tv.rowIndex] || []).some(r => r.id === id);
        if (alreadyPresent) {
          // Make sure both sides end up aliased to the same array going forward,
          // without pushing a duplicate into either.
          if (verseObj) {
            if (!verseObj.resources) verseObj.resources = [];
            churchResourcesMap[tv.rowIndex] = verseObj.resources;
          }
          return;
        }
        const list = (verseObj && verseObj.resources) || churchResourcesMap[tv.rowIndex] || [];
        list.push(sharedItem);
        if (verseObj) verseObj.resources = list;
        churchResourcesMap[tv.rowIndex] = list;
      });

      editingChurchResourceId = null;
      affectedRowIndexes.forEach(ri => {
        const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
        updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
      });
      renderResourcesTab();
    }

    export function updateChurchResourcesDOM(rowIndex, verseRef) {
      const container = document.getElementById(`church-resources-list-${rowIndex}`);
      if (!container) return;

      const crList = churchResourcesMap[rowIndex] || [];
      let resourcesListHtml = '';
      
      crList.forEach((crData, idx) => {
        const resUrl = crData.resource ? crData.resource.trim() : '';
        const resTitle = crData.title ? crData.title.trim() : '';
        const resType = crData.type ? crData.type.trim() : '';
        const resTags = crData.tags ? crData.tags.trim() : '';
        const resNotes = crData.notes ? crData.notes.trim() : '';

        if (resUrl || resTitle || resNotes) {
          if (currentUser && currentUser.isAdmin && editingChurchResourceId === crData.id) {
            resourcesListHtml += `<div class="church-resource-card">${renderChurchResourceEditFormHtml(crData, 'note', rowIndex, verseRef)}</div>`;
            return; // skip the normal display markup below while this card is being edited
          }

          let typeBadge = resType ? `<span class="type-tag">${resType}</span>` : '';
          let tagBadges = resTags ? resTags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join(' ') : '';
          let displayTitleText = escapeHtml(resTitle || resUrl);

          // A YouTube link (or a link that simply passes a YouTube video id through,
          // e.g. another site's own "watch" page) opens in the same full-screen
          // player used everywhere else in the app, instead of a plain link that
          // leaves the app in a new tab — independent of whether its thumbnail is
          // actually showing (an admin can turn the thumbnail off without losing the
          // in-app player). The thumbnail itself — YouTube's own, an admin's custom
          // override, a link that's itself an image, or none — is resolved by
          // resolveChurchResourceThumbnail so this card and the Line Upon Line one
          // stay in agreement about what a resource's thumbnail is.
          const youTubeId = resUrl ? getYouTubeVideoId(resUrl) : null;
          const thumbUrl = resolveChurchResourceThumbnail(crData);

          let titleHtml;
          if (youTubeId) {
            const safeUrlJs = resUrl.replace(/'/g, "\\'");
            const safeTitleJs = displayTitleText.replace(/'/g, "\\'");
            const safeVerseRefJs = (verseRef || '').replace(/'/g, "\\'");
            // With a thumbnail showing, the big centered play icon (playIconHtml,
            // below) already says "this plays a video" — without one, this small
            // inline glyph in front of the title carries that same meaning.
            const inlinePlayIcon = thumbUrl ? '' : `<span class="church-resource-video-inline-play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>`;
            titleHtml = `<button type="button" class="church-resource-video-trigger" onclick="openChurchResourceVideo('${safeUrlJs}', '${safeTitleJs}', '${safeVerseRefJs}')" title="Play video">
              <span class="church-resource-video-title" style="font-size: 16px; font-weight: bold; font-family: 'Plus Jakarta Sans', sans-serif;">${inlinePlayIcon}${displayTitleText}</span>
            </button>`;
          } else if (resUrl) {
            // A plain link title sitting over a custom thumbnail image needs to be
            // white (matching the video-title/notes treatment elsewhere on this same
            // background) — its color is set inline here rather than through the
            // .has-video-thumb CSS rules because an inline style always wins over
            // them regardless, so leaving it at the default primary-color would
            // otherwise be unreadable against a busy custom cover image.
            const linkIsOverCustomThumb = isCustomThumbnailShown(crData, thumbUrl);
            const linkColorStyle = linkIsOverCustomThumb ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85);' : 'color: var(--primary-color);';
            titleHtml = `<a href="${escapeHtml(resUrl)}" target="_blank" style="font-size: 16px; font-weight: bold; ${linkColorStyle} text-decoration: none; font-family: 'Plus Jakarta Sans', sans-serif;">${displayTitleText}</a>`;
          } else {
            titleHtml = displayTitleText ? `<span style="font-size: 16px; font-weight: bold; color: var(--text-main); font-family: 'Plus Jakarta Sans', sans-serif;">${displayTitleText}</span>` : '';
          }
          let notesHtml = resNotes ? `<div style="font-size: 13px; ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);' : 'color: var(--text-muted);'} margin-top: 4px; white-space: pre-wrap;">${escapeHtml(resNotes)}</div>` : '';
          const playIconHtml = (youTubeId && thumbUrl) ? `<div class="church-resource-video-playbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></div>` : '';
          // A "Booklet"-tagged resource showing its own custom thumbnail (its cover
          // image) gets top-anchored instead of the usual centered crop — see the
          // .thumb-top-align CSS rule for why.
          const bookletTopAlign = isCustomThumbnailShown(crData, thumbUrl) && hasBookletTag(resTags);
          const cardClass = thumbUrl ? `church-resource-card has-video-thumb${bookletTopAlign ? ' thumb-top-align' : ''}` : 'church-resource-card';
          const cardStyleAttr = thumbUrl ? ` style="background-image: linear-gradient(180deg, rgba(10,10,14,0.2) 0%, rgba(10,10,14,0.85) 100%), url('${thumbUrl.replace(/'/g, "\\'")}');"` : '';

          resourcesListHtml += `
            <div class="${cardClass}"${cardStyleAttr}>
              ${playIconHtml}
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                  ${typeBadge}
                </div>
                ${titleHtml ? `<div>${titleHtml}</div>` : ''}
              </div>
              ${notesHtml}
              ${tagBadges ? `<div style="margin-top: 4px;">${tagBadges}</div>` : ''}
              <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
                ${currentUser && currentUser.isAdmin ? `<button class="page-btn" style="padding: 2px 6px; font-size: 11px;" onclick="startEditChurchResource(${crData.id}, ${rowIndex}, '${verseRef}')">Edit</button>` : ''}
                ${currentUser && currentUser.isAdmin ? `<button class="page-btn" style="padding: 2px 6px; font-size: 11px; background: #fee2e2; color: #b91c1c; border-color: #fca5a5;" onclick="removeChurchResourceItem(${rowIndex}, '${verseRef}', ${idx})">Delete</button>` : ''}
              </div>
              <button class="share-btn resource-share-btn" title="Share this resource" onclick="shareResource(${crData.id}, '${verseRef}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </button>
            </div>`;
        }
      });
      container.innerHTML = resourcesListHtml;
    }

    // --- RESOURCES TAB LOGIC ("Line Upon Line") ---
    // Which book's references are currently expanded below the Old/New Testament lists.
    // Only one book is ever open at a time; re-clicking it collapses back to just the lists.
    export let activeLineUponLineBook = null;

    // Which individual resource cards (by their DB id) are expanded to show their
    // full notes/tags/admin controls, rather than the standard collapsed size. Kept
    // as a set of ids (not per-render state) so it survives renderResourcesTab()
    // being rebuilt from scratch — by a live-sync tick, a different book being
    // opened, etc. Any number of cards can be open at once (not an accordion).
    export let expandedResourceCardIds = new Set();

    export function toggleResourceCardExpanded(event, id) {
      // This is bound to a click anywhere on the card, so a click that landed on
      // one of the real <a>/<button> controls inside it (the video trigger, the
      // resource's own URL, Edit/Delete, Share) still runs that control's own
      // onclick first (the DOM fires the innermost listener before this one, since
      // this only runs once the click bubbles up) — this guard just stops it from
      // ALSO toggling the card underneath. The "Show more/less" indicator itself is
      // deliberately a plain <div>, not a <button>, so its clicks fall through to
      // this handler instead of being caught here.
      if (event.target.closest('a, button')) return;
      if (expandedResourceCardIds.has(id)) expandedResourceCardIds.delete(id);
      else expandedResourceCardIds.add(id);
      renderResourcesTab();
    }

    // Builds a single resource-card's HTML — shared by the (only) list of resources
    // shown under whichever book is currently expanded.
    export function renderResourceCardHtml(r) {
      if (currentUser && currentUser.isAdmin && editingChurchResourceId === r.id) {
        // Always "expanded" — an open edit form needs its full height, never the
        // standard collapsed size, and isn't itself click-to-toggle.
        return `<div class="resource-card expanded">${renderChurchResourceEditFormHtml(r, 'lul', r.rowIndex, r.verseRef)}</div>`;
      }

      let typeBadge = r.type ? `<span class="type-tag">${r.type}</span>` : '';
      let tagBadges = r.tags ? r.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join(' ') : '';
      let displayTitle = escapeHtml(r.title || r.resource);

      // Same resolution used by the Note view's Church Resources column, so a
      // resource's thumbnail (or lack of one) and its in-app video player both
      // agree no matter which of the two lists it's being shown in.
      const youTubeId = r.resource ? getYouTubeVideoId(r.resource) : null;
      const thumbUrl = resolveChurchResourceThumbnail(r);

      let titleHtml;
      if (youTubeId) {
        const safeUrlJs = (r.resource || '').replace(/'/g, "\\'");
        const safeTitleJs = (displayTitle || '').replace(/'/g, "\\'");
        const safeVerseRefJs = (r.verseRef || '').replace(/'/g, "\\'");
        const inlinePlayIcon = thumbUrl ? '' : `<span class="church-resource-video-inline-play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>`;
        titleHtml = `<button type="button" class="church-resource-video-trigger" onclick="openChurchResourceVideo('${safeUrlJs}', '${safeTitleJs}', '${safeVerseRefJs}')" title="Play video"><span class="church-resource-video-title">${inlinePlayIcon}${displayTitle}</span></button>`;
      } else {
        // See the matching comment in the Note view's Church Resources renderer —
        // a plain link title over a custom thumbnail image needs an inline white
        // color (an inline style always beats the .has-video-thumb h3 CSS rule that
        // would otherwise apply) so it stays readable against the cover image.
        const linkIsOverCustomThumb = isCustomThumbnailShown(r, thumbUrl);
        const linkColorStyle = linkIsOverCustomThumb ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85);' : 'color: var(--primary-color);';
        titleHtml = r.resource ? `<a href="${escapeHtml(r.resource)}" target="_blank" style="${linkColorStyle} text-decoration: none;">${displayTitle}</a>` : (displayTitle ? `<span>${displayTitle}</span>` : '');
      }
      let notesHtml = r.notes ? `<div style="font-size: 13px; ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);' : 'color: var(--text-muted);'} margin-top: 4px; white-space: pre-wrap;">${escapeHtml(r.notes)}</div>` : '';
      const playIconHtml = (youTubeId && thumbUrl) ? `<div class="church-resource-video-playbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></div>` : '';

      let verseRefHtml = r.verseRef ? `<div style="font-size: 15px; font-family: var(--font-heading); ${thumbUrl ? 'color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.85); border-bottom-color: rgba(255,255,255,0.4);' : 'color: var(--primary-color);'} letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${r.verseRef}</div>` : '';

      let adminBtns = '';
      if (currentUser && currentUser.isAdmin) {
        let safeRef = r.verseRef ? r.verseRef.replace(/'/g, "\\'") : '';
        let safeUrl = r.resource ? r.resource.replace(/'/g, "\\'") : '';
        let safeTitle = r.title ? r.title.replace(/'/g, "\\'") : '';
        adminBtns = `<div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px;">
          <button class="page-btn" style="padding: 2px 6px; font-size: 11px;" onclick="startEditChurchResource(${r.id}, ${r.rowIndex}, '${safeRef}')">Edit</button>
          <button class="page-btn" style="padding: 2px 6px; font-size: 11px; background: #fee2e2; color: #b91c1c; border-color: #fca5a5;" onclick="deleteResourceFromTab('${safeRef}', '${safeUrl}', '${safeTitle}', ${r.rowIndex})">Delete</button>
        </div>`;
      }

      const isExpanded = expandedResourceCardIds.has(r.id);
      // A "Booklet"-tagged resource showing its own custom thumbnail (its cover
      // image) gets top-anchored instead of the usual centered crop — see the
      // .thumb-top-align CSS rule for why.
      const bookletTopAlign = isCustomThumbnailShown(r, thumbUrl) && hasBookletTag(r.tags);
      const cardClass = `resource-card${thumbUrl ? ' has-video-thumb' : ''}${bookletTopAlign ? ' thumb-top-align' : ''}${isExpanded ? ' expanded' : ''}`;
      const cardStyleAttr = thumbUrl ? ` style="background-image: linear-gradient(180deg, rgba(10,10,14,0.2) 0%, rgba(10,10,14,0.85) 100%), url('${thumbUrl.replace(/'/g, "\\'")}');"` : '';
      const toggleChevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      return `
        <div class="${cardClass}"${cardStyleAttr} onclick="toggleResourceCardExpanded(event, ${r.id})">
          ${playIconHtml}
          ${verseRefHtml}
          <div style="display: flex; gap: 6px; margin-bottom: 6px;">${typeBadge}</div>
          ${titleHtml ? `<h3>${titleHtml}</h3>` : ''}
          <div class="resource-card-toggle">${isExpanded ? 'Show less' : 'Show more'} ${toggleChevronSvg}</div>
          <div class="resource-card-details">
            ${notesHtml}
            ${tagBadges ? `<div>${tagBadges}</div>` : ''}
            ${adminBtns}
            <button class="share-btn resource-share-btn" title="Share this resource" onclick="shareResource(${r.id}, '${(r.verseRef || '').replace(/'/g, "\\'")}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            </button>
          </div>
        </div>`;
    }

    // Flattens every church resource across the WHOLE Bible into a single list, each
    // tagged with the verse reference/rowIndex it belongs to (currentBibleVerses holds
    // every book, not just whatever chapter is currently open in the Note view). Shared
    // by the Old/New Testament book grouping below and by the "search all Church
    // Resources" box, so both always agree on exactly what counts as a resource.
    export function getAllChurchResourcesFlat() {
      const flat = [];
      if (!currentBibleVerses || currentBibleVerses.length === 0) return flat;

      currentBibleVerses.forEach(v => {
        let combined = [];
        let mapRes = churchResourcesMap[v.rowIndex] || [];
        let vRes = v.resources || [];

        mapRes.forEach(r => combined.push(r));
        vRes.forEach(r => {
          if (!combined.some(c => c.resource === r.resource && c.title === r.title)) {
            combined.push(r);
          }
        });

        combined.forEach(res => {
          if (res && (res.resource || res.title || res.notes)) {
            flat.push({ ...res, verseRef: v.reference, rowIndex: v.rowIndex });
          }
        });
      });

      return flat;
    }

    export function renderResourcesTab() {
      const grid = document.getElementById('resource-grid');
      if (!grid) return;

      // Same admin-only toggle pattern as Core-D's "⚙ Manage Content" button (see
      // renderFoundationsTab) — shown only for admins, re-checked on every call here
      // so signing in/out is reflected immediately without a page reload.
      const addResourceRow = document.getElementById('line-upon-line-add-resource-row');
      if (addResourceRow) addResourceRow.style.display = (currentUser && currentUser.isAdmin) ? 'block' : 'none';

      // Group every resource in the Bible by the book its verse belongs to.
      const resourcesByBook = {};
      getAllChurchResourcesFlat().forEach(res => {
        const lastSpace = res.verseRef.lastIndexOf(' ');
        const book = lastSpace !== -1 ? res.verseRef.substring(0, lastSpace) : res.verseRef;
        if (!resourcesByBook[book]) resourcesByBook[book] = [];
        resourcesByBook[book].push(res);
      });

      // If the book that was expanded no longer has anything under it (e.g. its last
      // resource was just deleted), fall back to just showing the book lists.
      if (activeLineUponLineBook && !(resourcesByBook[activeLineUponLineBook] || []).length) {
        activeLineUponLineBook = null;
      }

      // BIBLE_STUDIES_BOOK_ORDER is the full 66-book canonical order — Matthew is where
      // the New Testament begins (index 39), so it splits cleanly into OT/NT here too.
      const oldTestamentBooks = BIBLE_STUDIES_BOOK_ORDER.slice(0, 39);
      const newTestamentBooks = BIBLE_STUDIES_BOOK_ORDER.slice(39);

      const renderBookColumns = (books) => `
        <div class="line-upon-line-columns">
          ${books.map(book => {
            const count = (resourcesByBook[book] || []).length;
            const isActive = activeLineUponLineBook === book;
            const empty = count === 0;
            const safeBook = book.replace(/'/g, "\\'");
            return `<button type="button" class="line-upon-line-book ${isActive ? 'active' : ''} ${empty ? 'disabled' : ''}" onclick="selectLineUponLineBook('${safeBook}')">${book}${count ? `<span class="line-upon-line-count">${count}</span>` : ''}</button>`;
          }).join('')}
        </div>`;

      grid.innerHTML = `
        <div class="line-upon-line-testament">
          <h3 class="line-upon-line-heading">Old Testament</h3>
          ${renderBookColumns(oldTestamentBooks)}
        </div>
        <div class="line-upon-line-testament">
          <h3 class="line-upon-line-heading">New Testament</h3>
          ${renderBookColumns(newTestamentBooks)}
        </div>
        <div id="line-upon-line-panel" class="line-upon-line-panel" style="display:${activeLineUponLineBook ? 'block' : 'none'};"></div>`;

      if (activeLineUponLineBook) {
        renderLineUponLinePanel(activeLineUponLineBook, resourcesByBook[activeLineUponLineBook] || []);
      }

      // Whatever the trigger (first navigating here, live sync pulling in a resource
      // that was added while the user was already sitting on this tab, or opening a
      // specific book to read its "Resources by Verse" entries), this list is only
      // ever rebuilt while the user can actually see it — so a rebuild IS the user
      // seeing it, new entries included. Mark it seen right here rather than only on
      // the tab-switch click, otherwise the bubble next to "Line Upon Line" could keep
      // showing a stale "new" count even after the user opened the very book/verse
      // that new entry belongs to (selectLineUponLineBook() re-renders this same grid
      // but never itself switches sub-tabs, so it never used to clear the bubble).
      if (isResourcesSubTabVisible()) markStudySubTabSeen('resources');

      // Keep an active search's results in sync with whatever just changed here (a
      // resource added/edited/deleted, live sync pulling in something new) — mirrors
      // how the book panel above is refreshed on every call rather than only when the
      // user first opens a book. A no-op (leaves the area empty) while the search box
      // itself is empty, so this never draws anything the user didn't ask to see.
      renderLineUponLineSearchResults();
    }

    // Renders (or clears) the "search all Church Resources" results that live
    // between the search box and the Old Testament heading. Reads the search box's
    // current value fresh each time rather than caching it, the same pattern used by
    // renderFoundationsList()/#foundations-search-input — the input itself is a
    // persistent DOM node (never touched by renderResourcesTab's innerHTML rebuild
    // of #resource-grid), so typing in it is never interrupted by a re-render here.
    export function renderLineUponLineSearchResults() {
      const container = document.getElementById('line-upon-line-search-results');
      if (!container) return;

      const term = (document.getElementById('line-upon-line-search-input')?.value || '').trim().toLowerCase();

      // Nothing typed — leave the space between the search box and the Old Testament
      // heading completely empty, as if the search box weren't there at all.
      if (!term) {
        container.innerHTML = '';
        return;
      }

      const matches = getAllChurchResourcesFlat().filter(r =>
        (r.title && r.title.toLowerCase().includes(term)) ||
        (r.notes && r.notes.toLowerCase().includes(term)) ||
        (r.tags && r.tags.toLowerCase().includes(term)) ||
        (r.verseRef && r.verseRef.toLowerCase().includes(term)) ||
        (r.resource && r.resource.toLowerCase().includes(term)) ||
        (r.type && r.type.toLowerCase().includes(term))
      );

      if (matches.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">No Church Resources match "${escapeHtml(term)}".</div>`;
        return;
      }

      container.innerHTML = `
        <div style="color:var(--text-muted); font-size:13px; margin-bottom:8px;">Found ${matches.length} matching resource${matches.length === 1 ? '' : 's'}.</div>
        <div class="resource-grid-inner" style="margin-bottom:24px;">${matches.map(renderResourceCardHtml).join('')}</div>`;
    }

    // True only while the "Line Upon Line" (Resources by Verse) sub-tab is the one
    // actually on screen — i.e. the Study tab itself is active AND this is the active
    // sub-tab within it. Used to decide whether a render of the resources grid counts
    // as the user having seen it (see the end of renderResourcesTab above).
    export function isResourcesSubTabVisible() {
      const mainTab = document.getElementById('study-tab');
      const subContent = document.getElementById('study-sub-resources-content');
      return !!(mainTab && mainTab.classList.contains('active') && subContent && subContent.classList.contains('active'));
    }

    // Clicking a book expands its references below the lists, collapsing whichever book
    // was previously expanded; clicking the already-expanded book collapses it again.
    export function selectLineUponLineBook(book) {
      activeLineUponLineBook = (activeLineUponLineBook === book) ? null : book;
      renderResourcesTab();
      if (activeLineUponLineBook) {
        const panel = document.getElementById('line-upon-line-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    export function renderLineUponLinePanel(book, resources) {
      const panel = document.getElementById('line-upon-line-panel');
      if (!panel) return;

      if (resources.length === 0) {
        panel.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">No resources found for ${book} yet.</div>`;
        return;
      }

      panel.innerHTML = `
        <h3 class="line-upon-line-panel-title">${book}</h3>
        <div class="resource-grid-inner">${resources.map(renderResourceCardHtml).join('')}</div>`;
    }

    export async function deleteResourceFromTab(verseRef, resourceUrl, resourceTitle, rowIndex) {
      if (!currentUser || !currentUser.isAdmin) return;

      if (!confirm("Are you sure you want to delete this resource?")) return;

      const match = (churchResourcesMap[rowIndex] || []).find(r => r.resource === resourceUrl && r.title === resourceTitle);
      if (match && match.id != null) {
        const { error } = await churchResourcesTable.remove(match.id);
        if (error) {
          console.error('Error deleting resource:', error.message);
          alert('Could not delete resource: ' + error.message);
          return;
        }

        // This resource may be tied to more than just this one verse (see
        // saveNewChurchResource) — find every rowIndex currently displaying it
        // BEFORE removing it, so each of those Note-view columns is refreshed too,
        // not just this one.
        const affectedRowIndexes = new Set();
        Object.keys(churchResourcesMap).forEach(ri => {
          if ((churchResourcesMap[ri] || []).some(r => r.id === match.id)) affectedRowIndexes.add(Number(ri));
        });

        removeChurchResourceEverywhere(match.id);

        affectedRowIndexes.forEach(ri => {
          const v = currentBibleVerses.find(vv => vv.rowIndex === ri);
          updateChurchResourcesDOM(ri, v ? v.reference : verseRef);
        });
      } else if (churchResourcesMap[rowIndex]) {
        // No DB id to match on (shouldn't normally happen) — fall back to removing
        // just this one local copy by its url+title.
        const idx = churchResourcesMap[rowIndex].findIndex(r => r.resource === resourceUrl && r.title === resourceTitle);
        if (idx !== -1) churchResourcesMap[rowIndex].splice(idx, 1);
        const verseObj = currentBibleVerses.find(v => v.rowIndex === rowIndex);
        if (verseObj && verseObj.resources) {
          const vIdx = verseObj.resources.findIndex(r => r.resource === resourceUrl && r.title === resourceTitle);
          if (vIdx !== -1) verseObj.resources.splice(vIdx, 1);
        }
        updateChurchResourcesDOM(rowIndex, verseRef);
      }

      renderResourcesTab();
      updateStudyNotificationBadges();
    }

    // Works out what thumbnail (if any) a Church Resource card should show as its
    // background, in priority order: an admin's own custom thumbnail always wins;
    // otherwise a YouTube link gets YouTube's own thumbnail; otherwise a link that
    // is itself an image file gets used directly; anything else falls back to no
    // thumbnail (the plain card). An admin can turn a resource's thumbnail off
    // entirely regardless of what it would otherwise resolve to.
    export function resolveChurchResourceThumbnail(r) {
      if (!r || r.thumbnailHidden) return null;
      if (r.thumbnail) return r.thumbnail;
      const youTubeThumb = getYouTubeThumbnailUrl(r.resource);
      if (youTubeThumb) return youTubeThumb;
      if (isDirectImageUrl(r.resource)) return r.resource;
      return null;
    }

    // A resource's tags are a free-text, comma-separated string (e.g. "faith, hope,
    // Booklet") — this checks for an exact "Booklet" tag among them, case-insensitive
    // and whitespace-trimmed, so "Booklets" or a stray "booklet" inside some other
    // tag doesn't false-positive.
    export function hasBookletTag(tags) {
      if (!tags) return false;
      return tags.split(',').some(t => t.trim().toLowerCase() === 'booklet');
    }

    // True only when the thumbnail actually being shown for this resource is its
    // own admin-set custom thumbnail (as opposed to one auto-derived from a YouTube
    // link or a direct-image URL) — see resolveChurchResourceThumbnail's priority
    // order. thumbUrl is passed in rather than re-resolved so callers that already
    // computed it (every caller) don't do the resolution work twice.
    export function isCustomThumbnailShown(r, thumbUrl) {
      return !!thumbUrl && thumbUrl === r.thumbnail;
    }

    // Matches a Church Resource "Reference" field's ENTIRE value against a single
    // "Book Chapter:Verse" (optionally "-Verse" for a range, e.g. "John 3:16-18")
    // reference — anchored start-to-end since this validates a dedicated field's
    // whole content, unlike FOUNDATIONS_SCRIPTURE_REGEX (shared/coreD.js), which
    // hunts for references embedded anywhere inside free-form text. Only full,
    // exact book names are recognized (same as that regex) — "Genesis 1:1"
    // matches, "Gen 1:1" does not.
    //
    // Computed lazily on first actual use, rather than eagerly at module load —
    // BIBLE_STUDIES_BOOK_ORDER is imported from app.js, and this module is itself
    // imported back by app.js (a genuine circular dependency, same as elsewhere
    // in this app). Which of the two finishes initializing its top-level code
    // first isn't guaranteed, so a top-level IIFE referencing an imported binding
    // immediately can run before that binding is ready — exactly the bug this
    // same pattern caused in shared/coreD.js's own scripture regex, caught there
    // by an automated test that actually exercised it. Fixed proactively here
    // before it could cause the same failure.
    let _churchResourceReferenceRegexCache = null;
    function getChurchResourceReferenceRegex() {
      if (_churchResourceReferenceRegexCache) return _churchResourceReferenceRegexCache;
      const names = BIBLE_STUDIES_BOOK_ORDER
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      _churchResourceReferenceRegexCache = new RegExp(`^(${names.join('|')})\\s+(\\d{1,3}):(\\d{1,3})(?:\\s*[-–]\\s*\\d{1,3})?$`, 'i');
      return _churchResourceReferenceRegexCache;
    }

    // Resolves a typed Church Resource "Reference" field to the FIRST verse it
    // names (a typed range like "John 3:16-18" resolves to just John 3:16), and
    // only if that verse actually exists in the loaded Bible — a plausible-looking
    // but out-of-range chapter/verse (e.g. a chapter that doesn't have 99 verses)
    // is rejected same as text that doesn't look like a reference at all. Returns
    // the matching verse object (with its .rowIndex) on success, or null.
    export function resolveChurchResourceReferenceInput(text) {
      const trimmed = (text || '').trim().replace(/\s+/g, ' ');
      if (!trimmed) return null;
      const match = getChurchResourceReferenceRegex().exec(trimmed);
      if (!match) return null;
      const canonicalBook = BIBLE_STUDIES_BOOK_ORDER.find(b => b.toLowerCase() === match[1].toLowerCase());
      if (!canonicalBook) return null;
      const targetRef = `${canonicalBook} ${match[2]}:${match[3]}`;
      if (!currentBibleVerses || currentBibleVerses.length === 0) return null;
      return currentBibleVerses.find(v => v.reference === targetRef) || null;
    }

    // A Reference field can name more than one scripture at once, comma-separated
    // (e.g. "Genesis 1:1, John 3:16"), so a single resource can be tied to multiple
    // verses — each comma-separated piece is resolved on its own the same way a
    // single reference is (including "only the first verse of a range" for any
    // piece that's itself a range). Mirrors resolveChurchResourceReferenceInput's
    // "no match blocks with an error" rule: if ANY piece fails to resolve, the
    // whole field is rejected (verses: null) and every unrecognized piece is
    // listed, rather than silently saving a partial set. Exact duplicate verses
    // (naming the same one twice) are folded down to one. An empty field also
    // returns verses: null, same as an invalid one — callers already require at
    // least one reference.
    export function resolveChurchResourceReferenceList(text) {
      const parts = (text || '').split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return { verses: null, invalid: [] };
      const verses = [];
      const invalid = [];
      const seenRowIndexes = new Set();
      parts.forEach(part => {
        const v = resolveChurchResourceReferenceInput(part);
        if (!v) { invalid.push(part); return; }
        if (!seenRowIndexes.has(v.rowIndex)) {
          seenRowIndexes.add(v.rowIndex);
          verses.push(v);
        }
      });
      if (invalid.length > 0) return { verses: null, invalid };
      return { verses, invalid: [] };
    }

    // Entry points — look the video list up fresh at click time (rather than
    // serializing it into the onclick attribute) so it always reflects
    // whatever's currently saved, the same pattern used elsewhere in the app
    // (e.g. shareFoundationsSession).

    // Lets a Church Resources card (Note view) whose link is a YouTube video play
    // through the same full-screen player used for every other video in the app,
    // instead of just opening a new browser tab — same shared player, just handed
    // a one-video "playlist" like openBookVideoPlayer does above.
    export function openChurchResourceVideo(url, title, verseRef) {
      if (!url) return;
      openFsvPlayer([{ label: title || 'Video', url: url }], 0, verseRef || '');
    }