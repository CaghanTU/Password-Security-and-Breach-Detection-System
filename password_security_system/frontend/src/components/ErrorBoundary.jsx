import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="d-flex align-items-center justify-content-center min-vh-100">
          <div className="card border-danger p-4" style={{ maxWidth: 600 }}>
            <h4 className="text-danger">Uygulama Hatası</h4>
            <pre className="text-warning small mt-3" style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button className="btn btn-outline-danger mt-3" onClick={() => window.location.reload()}>
              Yenile
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
