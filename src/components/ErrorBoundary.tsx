import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep diagnostics local; do not send wallet/account contents to a third party.
    console.error('Nearmark UI error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-page">
          <div className="fatal-error-mark">NM</div>
          <div className="eyebrow">NEARMARK / UI RECOVERY</div>
          <h1>Something interrupted this view.</h1>
          <p>The application caught a rendering error. Your wallet keys are not stored by this page. Reload to try again.</p>
          <button className="button button-lime" onClick={() => window.location.reload()}>Reload Nearmark</button>
        </main>
      );
    }
    return this.props.children;
  }
}
