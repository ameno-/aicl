/**
 * A render failure stays where it happened: the fallback replaces only the
 * subtree (a card, a chat part, an applet, a screen), never the page.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** What failed, in the user's words: "component", "message part", "applet", "screen". */
  label: string;
  children: ReactNode;
  /** Called when the user presses Retry, before the subtree re-renders. */
  onReset?: () => void;
  /** The subtree re-renders on its own when any of these change. */
  resetKeys?: readonly unknown[];
}

interface State {
  error: Error | null;
}

const changed = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };
  private logged: Error | null = null;

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.logged === error) return;
    this.logged = error;
    console.warn(`[aicl] ${this.props.label} failed to render:`, error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && changed(prev.resetKeys, this.props.resetKeys)) this.reset(false);
  }

  private reset(notify: boolean): void {
    if (notify) this.props.onReset?.();
    this.logged = null;
    this.setState({ error: null });
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        data-aicl-error-boundary={this.props.label}
        style={{
          padding: '6px 10px',
          margin: '4px 0',
          fontSize: 12,
          lineHeight: 1.4,
          border: '1px solid #e0313155',
          borderRadius: 8,
          background: '#e031310d',
          color: 'inherit',
        }}
      >
        <span>This {this.props.label} failed to render</span>
        {' · '}
        <button
          type="button"
          onClick={() => this.reset(true)}
          style={{ font: 'inherit', background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
        >
          Retry
        </button>
        <details style={{ marginTop: 2, opacity: 0.8 }}>
          <summary style={{ cursor: 'pointer' }}>Details</summary>
          <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</pre>
        </details>
      </div>
    );
  }
}
