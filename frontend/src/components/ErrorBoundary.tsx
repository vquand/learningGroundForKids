import { uiText } from '../i18n/uiText';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-2xl bg-gray-100 px-4 py-6 text-center text-gray-500">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-sm">{uiText("Something went wrong loading this content.")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
