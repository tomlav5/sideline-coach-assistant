import { useEffect } from 'react';

/**
 * The project ref of the LIVE production Supabase database.
 *
 * This is not a secret: the production project URL and anon/publishable key for
 * this same ref already ship inside every client bundle we deploy (see `.env`).
 * It is hard-coded here purely so the running app can compare it against whatever
 * project it has actually connected to and shout if that is not what the current
 * context expects.
 */
const PRODUCTION_PROJECT_REF = 'crmlmnhillnnrnrxqera';

/** Height of the banner, in pixels. Kept small so it never dominates the UI. */
const BANNER_HEIGHT = 24;

type BannerVariant = 'prod-in-dev' | 'staging' | 'no-db';

/**
 * Resolve the Supabase project ref the app is ACTUALLY connected to, using the
 * exact same inputs as `src/integrations/supabase/client.ts`:
 *   1. `VITE_SUPABASE_PROJECT_ID`, else
 *   2. the first subdomain label of `VITE_SUPABASE_URL`.
 *
 * Deliberately ignores `import.meta.env.MODE` — the whole reason this component
 * exists is that the mode said "staging" while the env had silently fallen back
 * to the production `.env` file.
 */
function resolveConnectedProjectRef(): string | null {
  const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined)?.trim();
  if (projectId) {
    return projectId;
  }

  const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (rawUrl) {
    try {
      const [subdomain] = new URL(rawUrl).hostname.split('.');
      if (subdomain) {
        return subdomain;
      }
    } catch {
      // Malformed URL — fall through to "no ref".
    }
  }

  return null;
}

const VARIANT_STYLE: Record<BannerVariant, { background: string; color: string }> = {
  // Dangerous state: a dev server wired to the real database. Must look alarming.
  'prod-in-dev': { background: '#dc2626', color: '#ffffff' },
  // Any non-production project. Informational, clearly "not live".
  staging: { background: '#2563eb', color: '#ffffff' },
  // No database resolvable at all. Something is misconfigured.
  'no-db': { background: '#f59e0b', color: '#1c1917' },
};

/**
 * A thin, fixed, non-dismissible bar pinned to the very top of the viewport that
 * names the Supabase project the app is connected to whenever that is anything
 * other than "production, in a production build".
 */
export function EnvironmentBanner() {
  const connectedRef = resolveConnectedProjectRef();
  const isProduction = connectedRef === PRODUCTION_PROJECT_REF;
  const isDev = import.meta.env.DEV;

  // The normal live case: connected to production in a real production build.
  // Render absolutely nothing.
  const hidden = isProduction && !isDev;

  // Push the whole page down by the banner's height so it never covers the
  // app's own header. Scoped to while the banner is mounted and visible.
  useEffect(() => {
    if (hidden) {
      return;
    }
    const previous = document.body.style.paddingTop;
    document.body.style.paddingTop = `${BANNER_HEIGHT}px`;
    return () => {
      document.body.style.paddingTop = previous;
    };
  }, [hidden]);

  if (hidden) {
    return null;
  }

  let variant: BannerVariant;
  let message: string;

  if (!connectedRef) {
    variant = 'no-db';
    message = 'No database configured';
  } else if (isProduction) {
    variant = 'prod-in-dev';
    message = `Dev server — connected to production database · ${connectedRef.slice(0, 8)}`;
  } else {
    variant = 'staging';
    message = `Staging · ${connectedRef.slice(0, 8)}`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="environment-banner"
      data-variant={variant}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: BANNER_HEIGHT,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 8px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        lineHeight: 1,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        pointerEvents: 'none',
        userSelect: 'none',
        ...VARIANT_STYLE[variant],
      }}
    >
      {message}
    </div>
  );
}
