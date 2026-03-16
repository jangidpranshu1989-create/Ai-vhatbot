import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl max-w-md space-y-6">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Bhai, Crash Ho Gaya!</h2>
              <p className="text-slate-400 text-sm">
                Sigma mode mein kuch error aa gaya. Shayad server down hai ya logic fail ho gaya.
              </p>
              {this.state.error && (
                <pre className="mt-4 p-3 bg-black/50 rounded-xl text-[10px] text-red-400 overflow-x-auto text-left">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCcw className="w-4 h-4" /> Restart Sigma Mode
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
