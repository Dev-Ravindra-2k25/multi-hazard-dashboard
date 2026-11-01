import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container" role="alert">
          <div className="error-boundary-card">
            <span className="error-boundary-icon">⚠️</span>
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-desc">
              An unexpected error occurred while loading this dashboard view. You can reload or return to the main dashboard.
            </p>
            <div className="error-boundary-actions">
              <button
                type="button"
                className="btn-retry"
                onClick={this.handleReload}
              >
                🔄 Reload Page
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={this.handleReset}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
