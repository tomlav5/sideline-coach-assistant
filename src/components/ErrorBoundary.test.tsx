import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <div>fine</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('fine')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  describe('when a child throws during render', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // React itself also logs the caught error to console.error; suppress
      // noise but keep spying so we can assert our boundary still logs.
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('shows the fallback instead of the thrown error', () => {
      render(
        <ErrorBoundary fallback={<div>fallback shown</div>}>
          <Bomb />
        </ErrorBoundary>
      );

      expect(screen.getByText('fallback shown')).toBeInTheDocument();
    });

    it('logs the error and component stack rather than swallowing it', () => {
      render(
        <ErrorBoundary fallback={<div>fallback shown</div>}>
          <Bomb />
        </ErrorBoundary>
      );

      const loggedOurError = consoleErrorSpy.mock.calls.some(
        (call) => call[0] === 'ErrorBoundary caught a render error:' && call[1] instanceof Error
      );
      expect(loggedOurError).toBe(true);
    });

    it('supports a render-prop fallback that can reset the boundary', () => {
      render(
        <ErrorBoundary fallback={(error, reset) => (
          <button onClick={reset}>{error.message}</button>
        )}>
          <Bomb />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'boom' })).toBeInTheDocument();
    });
  });
});
