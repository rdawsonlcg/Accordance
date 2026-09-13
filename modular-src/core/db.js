// ============================================================================
// core/db.js — the shared per-table data-access layer.
//
// `supabaseClient` is intentionally NOT created or imported here — it's set
// up in a separate, earlier <script> tag (Supabase client config + the
// "remember this device" auth storage adapter) and, since classic (non-
// module) <script> tags share one global scope, is simply available here as
// a pre-existing global by the time any of this actually runs. This mirrors
// exactly how it worked before this file was split out; wiring it through a
// real import is a good next step once more of the app is modularized.
// ============================================================================

// Supabase's default row cap per request is 1000. Most tables this app calls
// fetchAllRows on (badges, Core-D classes, TW modules, reading schedules, etc.)
// are well under that, so this fetches the first page directly and only pays
// for a separate COUNT query if that first page comes back completely full —
// the old version ran that COUNT query unconditionally on every call, which
// was a wasted extra round-trip for every table that fits in one page. For a
// genuinely large table (like `verses`, ~31k rows), the remaining pages are
// still fetched in PARALLEL (not one-at-a-time) to minimize wall-clock time.
// Ordering by `id` is required — without it, .range()-based pagination has no
// guaranteed row order and pages can come back out of sequence.
export async function fetchAllRows(table, selectCols, modify, orderColumn = 'id') {
  const PAGE = 1000;

  let firstQuery = supabaseClient.from(table).select(selectCols).order(orderColumn, { ascending: true }).range(0, PAGE - 1);
  if (modify) firstQuery = modify(firstQuery);
  const { data: firstPage, error: firstError } = await firstQuery;
  if (firstError) throw firstError;

  if (firstPage.length < PAGE) return firstPage; // whole table fit in one request — no COUNT query needed

  // First page was completely full — there may be more, so it's worth
  // finding out exactly how many pages exist and fetching the rest in parallel.
  let countQuery = supabaseClient.from(table).select('*', { count: 'exact', head: true });
  if (modify) countQuery = modify(countQuery);
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE));
  const pagePromises = [];
  for (let i = 1; i < totalPages; i++) {
    const from = i * PAGE;
    let query = supabaseClient.from(table).select(selectCols).order(orderColumn, { ascending: true }).range(from, from + PAGE - 1);
    if (modify) query = modify(query);
    pagePromises.push(query);
  }

  const results = await Promise.all(pagePromises);
  let all = firstPage.slice();
  results.forEach(({ data, error }) => {
    if (error) throw error;
    all = all.concat(data);
  });
  return all;
}

// ------------------------------------------------------------------
// Minimal per-table data accessor — a pilot for consolidating the ~60
// scattered supabaseClient.from(table)... call sites across the app.
// Deliberately "thin": it only performs the network call and hands back
// Supabase's own {data, error} shape unchanged. Error handling, alerts,
// and local-cache updates all stay exactly where they were, in each
// calling function — that's real business logic that differs per screen,
// not boilerplate worth abstracting away. This only replaces the
// mechanical "which table, which columns, which id" part.
//
// Piloted on book_shelf_groups first (see bookShelfGroupsTable below) —
// once confirmed working end-to-end, more tables can move onto this same
// accessor one at a time.
// ------------------------------------------------------------------
export function createTableAccessor(tableName) {
  return {
    // A plain passthrough to .from(tableName).select(cols) — for reads
    // whose filtering/ordering genuinely varies per call site (a plain
    // fetch-all belongs in fetchAllRows instead). Still returns the real
    // Supabase query builder, so callers keep chaining .eq()/.order()/etc.
    // onto it exactly as before; this only centralizes the table name.
    select(cols) {
      return supabaseClient.from(tableName).select(cols);
    },
    insert(payload, selectCols) {
      const query = supabaseClient.from(tableName).insert(payload);
      return selectCols ? query.select(selectCols).single() : query;
    },
    // For inserting several rows at once (e.g. a bulk "import" action) —
    // no .single(), since Supabase correctly returns an array for a
    // multi-row insert and .single() would error expecting exactly one.
    insertMany(rows, selectCols) {
      const query = supabaseClient.from(tableName).insert(rows);
      return selectCols ? query.select(selectCols) : query;
    },
    upsert(payload, selectCols, options) {
      const query = supabaseClient.from(tableName).upsert(payload, options);
      return selectCols ? query.select(selectCols).single() : query;
    },
    // For upserting several rows at once (e.g. a bulk "import" action) —
    // no .single(), for the same reason as insertMany above.
    upsertMany(rows, selectCols, options) {
      const query = supabaseClient.from(tableName).upsert(rows, options);
      return selectCols ? query.select(selectCols) : query;
    },
    update(id, payload, selectCols) {
      const query = supabaseClient.from(tableName).update(payload).eq('id', id);
      return selectCols ? query.select(selectCols).single() : query;
    },
    // Same passthrough idea as deleteQuery() — for an update that needs
    // more than the single eq('id', id) filter to target the right row(s).
    updateQuery(payload) {
      return supabaseClient.from(tableName).update(payload);
    },
    remove(id) {
      return supabaseClient.from(tableName).delete().eq('id', id);
    },
    // For deleting by some other column than the primary key — e.g. the
    // delete-account cleanup routine removes several tables' rows by
    // user_id/sender_id, not by each row's own id.
    removeWhere(column, value) {
      return supabaseClient.from(tableName).delete().eq(column, value);
    },
    // For a delete that needs more than one filter chained on (e.g.
    // .eq('user_id', x).in('schedule_id', ids)) — same passthrough
    // philosophy as select() above: hands back the real query builder,
    // pre-scoped to this table, for the caller to keep chaining.
    deleteQuery() {
      return supabaseClient.from(tableName).delete();
    }
  };
}

export const readingSchedulesTable = createTableAccessor('reading_schedules');
export const twCourseProgressTable = createTableAccessor('tw_course_progress');
export const churchResourcesTable = createTableAccessor('church_resources');
export const cordMessagesTable = createTableAccessor('cord_messages');
export const cordMembersTable = createTableAccessor('cord_members');
export const marginNotesTable = createTableAccessor('margin_notes');
export const recordsTable = createTableAccessor('records');
export const userReadingPlansTable = createTableAccessor('user_reading_plans');
export const userReadingProgressTable = createTableAccessor('user_reading_progress');
export const userResourceClicksTable = createTableAccessor('user_resource_clicks');
export const profilesTable = createTableAccessor('profiles');
