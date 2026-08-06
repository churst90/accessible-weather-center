import React from "react";

/**
 * Last line of defense for render crashes. Without this, a throwing scene
 * view unmounts the whole tree — including the aria-live announcement
 * region — so a screen-reader user experiences the app simply going
 * silent. The fallback renders inside a role="alert" region, which fires
 * an assertive announcement on its own without needing the (unmounted)
 * announcer plumbing.
 *
 * Give the boundary a `resetKey` that changes when the failing subtree's
 * inputs change (e.g. the scene id) so a crash in one scene doesn't stick
 * for the rest of the session.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string | number },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { resetKey?: string | number }) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Scene render crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <section role="alert" className="ws-unavailable">
          <h2 className="ws-unavailable-title">Display problem</h2>
          <p className="ws-unavailable-reason">
            This screen hit an error and could not be shown. The rest of the
            application is still running — press Tab to move to the next
            scene.
          </p>
        </section>
      );
    }
    return this.props.children;
  }
}
