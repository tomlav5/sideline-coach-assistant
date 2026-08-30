import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EnvironmentBanner } from './EnvironmentBanner';

// The real production project ref, mirrored from EnvironmentBanner.tsx.
const PRODUCTION_REF = 'crmlmnhillnnrnrxqera';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.body.style.paddingTop = '';
});

describe('EnvironmentBanner', () => {
  // The normal live case must be completely invisible — no bar, no layout shift.
  it('renders nothing when connected to production in a production build', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', PRODUCTION_REF);
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const { container } = render(<EnvironmentBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(document.body.style.paddingTop).toBe('');
  });

  // The dangerous state: a dev server pointed at the real database.
  it('renders the red production warning when connected to production from a dev server', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', PRODUCTION_REF);

    render(<EnvironmentBanner />);

    const banner = screen.getByTestId('environment-banner');
    expect(banner).toHaveAttribute('data-variant', 'prod-in-dev');
    expect(banner).toHaveTextContent(/dev server .* connected to production database/i);
    expect(banner).toHaveTextContent(PRODUCTION_REF.slice(0, 8));
    expect(banner).toHaveStyle({ backgroundColor: '#dc2626' });
    expect(document.body.style.paddingTop).toBe('24px');
  });

  // Any non-production ref: informational blue "staging" bar.
  it('renders the blue staging bar for a non-production project ref', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', 'xszbopufqchbfbqwvqbb');

    render(<EnvironmentBanner />);

    const banner = screen.getByTestId('environment-banner');
    expect(banner).toHaveAttribute('data-variant', 'staging');
    expect(banner).toHaveTextContent(/staging/i);
    expect(banner).toHaveTextContent('xszbopuf');
    expect(banner).not.toHaveTextContent(/production database/i);
    expect(banner).toHaveStyle({ backgroundColor: '#2563eb' });
    expect(document.body.style.paddingTop).toBe('24px');
  });

  // Nothing resolvable at all: amber "misconfigured" bar.
  it('renders the amber bar when no project ref can be resolved', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');

    render(<EnvironmentBanner />);

    const banner = screen.getByTestId('environment-banner');
    expect(banner).toHaveAttribute('data-variant', 'no-db');
    expect(banner).toHaveTextContent(/no database configured/i);
    expect(banner).toHaveStyle({ backgroundColor: '#f59e0b' });
  });

  // Falls back to the URL subdomain when no explicit project id is set,
  // exactly as src/integrations/supabase/client.ts does.
  it('derives the ref from the VITE_SUPABASE_URL subdomain when no project id is set', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', '');
    vi.stubEnv('VITE_SUPABASE_URL', `https://${PRODUCTION_REF}.supabase.co`);

    const { container } = render(<EnvironmentBanner />);

    // Production ref via URL + production build => invisible.
    expect(container).toBeEmptyDOMElement();
  });
});
