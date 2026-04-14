export default function Login() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card p-10 w-full max-w-md text-center">
        <div className="mx-auto w-10 h-10 rounded-lg bg-gradient-to-br from-accent-400 to-fuchsia-500 mb-6" />
        <h1 className="text-2xl font-semibold mb-2">Sign in to saasobserve</h1>
        <p className="text-sm text-ink-100/70 mb-8">
          We use your Google account to identify your tenant.
        </p>
        <a href={`${apiBase}/api/auth/google/start`} className="btn btn-primary w-full">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 48 48" fill="currentColor" aria-hidden>
            <path d="M44.5 20H24v8.5h11.7C34.7 33 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34 5.6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.6-.2-4z"/>
          </svg>
          Continue with Google
        </a>
        <p className="mt-6 text-xs text-ink-100/50">
          By signing in you agree to be responsible for the telemetry you send us.
        </p>
      </div>
    </main>
  );
}
