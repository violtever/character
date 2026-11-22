import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'Đã xảy ra sự cố ngoài ý muốn khi hiển thị thư viện.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error?.includes('Missing or insufficient permissions')) {
        friendly =
          'Bạn không có quyền thực hiện thao tác dữ liệu này. Vui lòng kiểm tra trạng thái đăng nhập hoặc quyền hạn tài khoản.';
      }
    } catch {
      if (error.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-6 text-[var(--ink-primary)]">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center shadow-xl">
            <p className="font-mono-archive text-xs tracking-widest text-[var(--accent-primary)] uppercase">
              xocyberluv’s character archive
            </p>
            <h1 className="font-editorial mt-3 text-3xl font-semibold">
              Có một chút gián đoạn
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-secondary)]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent-primary)] px-6 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
