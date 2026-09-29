/**
 * A minimal recording stand-in for the Supabase query builder, for testing lib
 * functions that chain `from().select().eq()...single()` etc.
 *
 * Every executed query is pushed to `calls` with its table, operation, payload
 * and filters. `respond` decides what each query returns. Use with:
 *
 *   const fake = vi.hoisted(() => ({ calls: [], respond: () => ({ data: null, error: null }) }));
 *   vi.mock('@/integrations/supabase/client', async () =>
 *     (await import('@/test/fakeSupabase')).fakeSupabaseModule(fake));
 */
export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert';
  payload?: unknown;
  filters: Record<string, unknown>;
  ordered?: boolean;
}

export interface FakeResult {
  data: unknown;
  error: unknown;
}

export interface FakeState {
  calls: FakeCall[];
  respond: (call: FakeCall) => FakeResult;
}

function builder(state: FakeState, table: string) {
  const call: FakeCall = { table, op: 'select', filters: {} };
  const exec = () => {
    state.calls.push(call);
    return Promise.resolve(state.respond(call));
  };
  const b = {
    select: () => b,
    insert: (payload: unknown) => {
      call.op = 'insert';
      call.payload = payload;
      return b;
    },
    update: (payload: unknown) => {
      call.op = 'update';
      call.payload = payload;
      return b;
    },
    upsert: (payload: unknown) => {
      call.op = 'upsert';
      call.payload = payload;
      return b;
    },
    eq: (key: string, value: unknown) => {
      call.filters[key] = value;
      return b;
    },
    in: (key: string, value: unknown) => {
      call.filters[key] = value;
      return b;
    },
    order: () => {
      call.ordered = true;
      return b;
    },
    limit: () => b,
    single: exec,
    maybeSingle: exec,
    then: (onFulfilled: (r: FakeResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      exec().then(onFulfilled, onRejected),
  };
  return b;
}

export function fakeSupabaseModule(state: FakeState) {
  return { supabase: { from: (table: string) => builder(state, table) } };
}

/** The write calls (insert / update / upsert) recorded so far. */
export function writes(state: FakeState): FakeCall[] {
  return state.calls.filter((c) => c.op !== 'select');
}
