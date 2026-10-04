import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { Button } from "../ui/button";

/** Contains a render crash to the page that threw it, instead of blanking the
 * whole app. Keyed on the route by its parent so navigating away resets it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong on this page"
        description={this.state.error.message}
        action={
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        }
      />
    );
  }
}
