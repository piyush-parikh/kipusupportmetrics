import { Component } from 'react'

// APT-149: last resort for a render crash, so a broken page shows something
// readable instead of a blank screen. Deliberately minimal.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 className="login-title">Something went wrong</h1>
          <p className="login-note">Reload the page to carry on.</p>
          <div className="login-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    )
  }
}
