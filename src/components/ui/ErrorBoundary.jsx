import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

// Catches a render error in one view (a tab panel, a drawer) so the rest of the page stays up.
// Shows an inline card with "Reload view" (re-mounts the children) and logs the error to the console.
//   resetKey: when it changes (another tab, another filter) the boundary clears itself
//   floating: for drawers, which have no place in the page flow — the card sits bottom-right instead
export default class ErrorBoundary extends Component {
  state = { error: null, attempt: 0 }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.name ?? 'view'}] failed to render:`, error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  reload = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))

  render() {
    if (!this.state.error) return <Fallback key={this.state.attempt}>{this.props.children}</Fallback>
    return (
      <div role="alert"
        className={`${this.props.floating ? 'fixed bottom-6 right-6 z-[60] w-80 shadow-lg' : 'w-full'} flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5`}>
        <p className="text-[14px] leading-5 text-stone-900">Something went wrong loading this view.</p>
        <button type="button" onClick={this.reload}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus">
          <RefreshCw size={14} aria-hidden /> Reload view
        </button>
      </div>
    )
  }
}

// keyed wrapper: "Reload view" bumps the key so the children mount fresh
const Fallback = ({ children }) => children
