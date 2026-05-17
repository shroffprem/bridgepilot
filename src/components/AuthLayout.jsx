import React from "react";

export default function AuthLayout({ children, footer }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left branding panel */}
      <div className="relative hidden md:flex md:w-1/2 bg-sidebar flex-col items-center justify-center p-12 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 text-center">
          {/* Logo mark */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <path d="M6 28 L6 10 L17 4 L28 10 L28 28" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
                <rect x="12" y="17" width="10" height="11" rx="1" fill="white" opacity="0.9"/>
                <circle cx="17" cy="13" r="2.5" fill="white" opacity="0.7"/>
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-sidebar-foreground tracking-tight mb-2">
            BridgeLine Partners
          </h1>
          <p className="text-sidebar-foreground/50 text-base font-medium mb-12">
            MIS & Portfolio Management
          </p>

          {/* Feature bullets */}
          <div className="space-y-4 text-left max-w-xs mx-auto">
            {[
              { icon: "📊", label: "Real-time loan portfolio tracking" },
              { icon: "✅", label: "Multi-stage approval workflows" },
              { icon: "📱", label: "WhatsApp borrower notifications" },
              { icon: "📈", label: "MTD / YTD financial analytics" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <span className="text-sidebar-foreground/70 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 absolute bottom-8 text-sidebar-foreground/30 text-xs">
          © {new Date().getFullYear()} BridgeLine Partners. All rights reserved.
        </p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-0">
        {/* Mobile logo */}
        <div className="flex flex-col items-center mb-8 md:hidden">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-3">
            <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
              <path d="M6 28 L6 10 L17 4 L28 10 L28 28" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none"/>
              <rect x="12" y="17" width="10" height="11" rx="1" fill="white" opacity="0.9"/>
              <circle cx="17" cy="13" r="2.5" fill="white" opacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">BridgeLine Partners</h1>
          <p className="text-xs text-muted-foreground mt-0.5">MIS & Portfolio Management</p>
        </div>

        <div className="w-full max-w-sm">
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}