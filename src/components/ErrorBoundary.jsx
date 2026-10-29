import { Component } from 'react';
import { NavCtx } from '../lib/nav.js';
import { forgetPlace } from '../lib/kept.js';
import { reportError } from '../lib/crash.js';
import { Spot } from './Spot.jsx';

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
    // A crash report (crash.js), with which components it was in; nothing without a Sentry DSN
    reportError(error, { componentStack: info?.componentStack, where: 'screen' });
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
        {/* One centred column like the gone states, with their lone ball over it (more-8) */}
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Spot kind="loneball" size={150} className="eb-art" />
          <div className="et" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <div className="es" style={{ color: 'var(--mute)', marginBottom: 20 }}>Your scores and rounds are safe. Head back and carry on.</div>
          <details style={{ alignSelf: 'stretch', fontSize: 13, color: 'var(--mute)', textAlign: 'left', marginBottom: 20 }}>
            <summary style={{ cursor: 'pointer', textAlign: 'center' }}>Show details</summary>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 8 }}>{String(this.state.error?.message || this.state.error)}</pre>
          </details>
          <button className="full-btn" onClick={this.reset}>Back to Up next</button>
          {this.context && <button className="full-btn outline" style={{ marginTop: 8 }} onClick={this.report}>Tell us what happened</button>}
          </div>
        </div>
      </div>
    );
  }
}
