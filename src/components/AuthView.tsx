import type { FormEvent } from "react";

type AuthViewProps = {
  loginConfigured: boolean;
  loginForm: {
    username: string;
    password: string;
  };
  loginError: string;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onLoginFormChange: (form: { username: string; password: string }) => void;
};

export function AuthView({
  loginConfigured,
  loginForm,
  loginError,
  onLogin,
  onLoginFormChange,
}: AuthViewProps) {
  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand auth-brand">
          <div className="brand-mark">DSA</div>
          <div>
            <h1>Tracker</h1>
            <p>Private DSA practice board with a simple login gate.</p>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Welcome back</p>
          <h2>Log in.</h2>
          <p className="hero-copy">Use your `.env` values.</p>
          {!loginConfigured ? (
            <div className="banner error">
              Set <code>USERNAME</code> and <code>PASSWORD</code> in your <code>.env</code> file to enable sign in.
            </div>
          ) : null}
        </div>
      </section>

      <section className="auth-card">
        <p className="panel-label">Secure access</p>
        <h3>Sign in</h3>
        <p className="auth-note">Local login only.</p>

        <form className="auth-form" onSubmit={onLogin}>
          <label>
            Username
            <input
              value={loginForm.username}
              onChange={(event) => onLoginFormChange({ ...loginForm, username: event.target.value })}
              autoComplete="username"
              placeholder="name@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => onLoginFormChange({ ...loginForm, password: event.target.value })}
              autoComplete="current-password"
              placeholder="Password"
            />
          </label>

          {loginError ? <div className="banner error">{loginError}</div> : null}

          <button className="primary-btn auth-submit" type="submit">
            Enter Tracker
          </button>
        </form>
      </section>
    </main>
  );
}
