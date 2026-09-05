import React, { Suspense, useState, useEffect, type ComponentType, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface LazyBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyErrorBoundary({ children, fallback }: LazyBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setHasError(false);
    setError(null);
  }, [retryKey, children]);

  if (hasError) {
    return (
      fallback ?? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">页面加载失败</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error?.message ?? '动态模块加载失败，请检查网络后重试'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRetryKey((k) => k + 1)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重新加载
          </Button>
        </div>
      )
    );
  }

  return (
    <ErrorBoundary onError={(e) => { setError(e); setHasError(true); }}>
      <React.Fragment key={retryKey}>{children}</React.Fragment>
    </ErrorBoundary>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface LazyRetryWrapperProps {
  factory: () => Promise<{ default: ComponentType }>;
  fallback?: ReactNode;
  maxRetries?: number;
}

export function LazyRetryWrapper({ factory, fallback, maxRetries = 3 }: LazyRetryWrapperProps) {
  const LazyComponent = React.lazy(() => retryImport(factory, maxRetries));
  return (
    <LazyErrorBoundary fallback={fallback}>
      <Suspense
        fallback={
          fallback ?? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )
        }
      >
        <LazyComponent />
      </Suspense>
    </LazyErrorBoundary>
  );
}

async function retryImport<T>(factory: () => Promise<T>, maxRetries: number, attempt = 1): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    if (attempt >= maxRetries) {
      throw error;
    }
    await delay(Math.min(1000 * attempt, 3000));
    return retryImport(factory, maxRetries, attempt + 1);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
