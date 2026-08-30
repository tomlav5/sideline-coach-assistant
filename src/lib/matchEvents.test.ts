import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MATCH_EVENT_TYPES } from './matchEvents';

// Files that actually write to match_events (insert/upsert/update), found via:
//   grep -rl "from('match_events')" src | xargs grep -l "\.\(insert\|upsert\|update\)("
// Display-only components are deliberately excluded: their declared event_type
// unions have drifted from what's actually written and would produce false
// positives here.
const WRITE_PATH_FILES = [
  'src/components/match/EnhancedEventDialog.tsx',
  'src/hooks/useRetrospectiveMatch.tsx',
  'src/hooks/useEditMatchData.tsx',
  'src/pages/EnhancedMatchTracker.tsx',
  'src/components/fixtures/RetrospectiveMatchDialog.tsx',
];

const REPO_ROOT = path.resolve(__dirname, '../..');

function findEventTypeLiterals(source: string): string[] {
  const literals: string[] = [];
  const runPattern = /event_type\??:\s*((?:'[a-zA-Z_]+'\s*\|?\s*)+)/g;
  let runMatch: RegExpExecArray | null;
  while ((runMatch = runPattern.exec(source)) !== null) {
    const literalPattern = /'([a-zA-Z_]+)'/g;
    let literalMatch: RegExpExecArray | null;
    while ((literalMatch = literalPattern.exec(runMatch[1])) !== null) {
      literals.push(literalMatch[1]);
    }
  }
  return literals;
}

describe('MATCH_EVENT_TYPES', () => {
  // Protects against the app writing an event_type value the DB constraint would reject,
  // which would surface as a live-match write failure instead of a caught test failure.
  it('includes every event_type literal written by application code', () => {
    const found = new Set<string>();
    for (const relativePath of WRITE_PATH_FILES) {
      const source = readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');
      for (const literal of findEventTypeLiterals(source)) {
        found.add(literal);
      }
    }

    // Sanity check that the scan itself is finding something, not silently matching zero files.
    expect(found.size).toBeGreaterThan(0);

    for (const literal of found) {
      expect(MATCH_EVENT_TYPES).toContain(literal);
    }
  });
});
