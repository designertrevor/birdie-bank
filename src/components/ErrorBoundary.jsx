import { Component } from 'react';
import { NavCtx } from '../lib/nav.js';
import { forgetPlace } from '../lib/kept.js';

/**
 * Last line of defence: if a screen throws, show a way back instead of a blank page.
 * Data is untouched. Everything is already saved in localStorage.
 */
export default class ErrorBoundary extends Component {
  static contextType = NavCtx;
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('Birdie Bank crashed:', error, info?.componentStack);
    // Never come back to a screen that just crashed: the next launch starts on Up next
    forgetPlace();
  }
  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };
  // Turn the crash into a bug report, with the error already filled in
  report = () => {
    const what = `The app showed "Something went wrong".\n\n${String(this.state.error?.message || this.state.error)}`;
    this.setState({ error: null });
    this.context?.reset('history', ['suggest', { kind: 'bug', prefill: { what } }]);
  };
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen active">
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div className="et" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <div className="es" style={{ color: 'var(--mute)', marginBottom: 20 }}>Your scores and rounds are safe. Head back and carry on.</div>
          <details style={{ fontSize: 13, color: 'var(--mute)', textAlign: 'left', marginBottom: 20 }}>
            <summary style={{ cursor: 'pointer', textAlign: 'center' }}>Show details</summary>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
          <button className="full-btn" onClick={this.reset}>Back to Up next</button>
          {this.context && <button className="full-btn outline" style={{ marginTop: 8 }} onClick={this.report}>Tell us what happened</button>}
        </div>
      </div>
    );
  }
}
