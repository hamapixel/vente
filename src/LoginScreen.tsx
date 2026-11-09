import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LockKeyhole, ShieldCheck, Shirt, WifiOff } from "lucide-react";
import { api } from "./api";
import type { LoginBrand, UserSession } from "./types";

interface Props {
  setup: boolean;
  onSuccess: (user: UserSession) => void;
  browserPreview: boolean;
  brand: LoginBrand;
}

export default function LoginScreen({ setup, onSuccess, browserPreview, brand }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (browserPreview || busy) return;

    if (setup && password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const session = setup
        ? await api.registerAdmin(username.trim(), password)
        : await api.login(username.trim(), password);
      setPassword("");
      setConfirm("");
      onSuccess(session);
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="compact-login-page">
      <div className="compact-login-card">
        <div className="compact-login-brand">
          <div className="compact-login-logo">
            {brand.logoData
              ? <img src={brand.logoData} alt={"Logo de " + brand.name} />
              : <Shirt size={28} strokeWidth={1.9} />}
          </div>
          <div className="compact-login-appname">ModeStock <span>Local</span></div>
          {brand.name !== "Ma boutique" && <div className="compact-login-shop">{brand.name}</div>}
        </div>

        <div className="compact-login-heading">
          <span className="compact-login-eyebrow">
            <LockKeyhole size={14} />
            {setup ? "PREMIÈRE UTILISATION" : "ESPACE SÉCURISÉ"}
          </span>
          <h1>{setup ? "Créer votre accès" : "Bienvenue !"}</h1>
          <p>{setup ? "Configurez le compte administrateur de votre boutique." : "Connectez-vous pour accéder à votre boutique."}</p>
        </div>

        <form className="compact-login-form" onSubmit={submit}>
          {browserPreview && <div className="auth-error" role="alert">Ouvrez ModeStock dans la fenêtre Tauri, pas dans le navigateur.</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}

          <label htmlFor="login-username">Identifiant</label>
          <input
            id="login-username" required autoFocus
            minLength={setup ? 3 : undefined}
            autoComplete="username"
            maxLength={50}
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Votre identifiant"
          />

          <label htmlFor="login-password">Mot de passe</label>
          <div className="compact-password-field">
            <input
              id="login-password" required
              type={visible ? "text" : "password"}
              minLength={setup ? 8 : undefined} maxLength={128}
              autoComplete={setup ? "new-password" : "current-password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Votre mot de passe"
            />
            <button type="button" aria-label={visible ? "Masquer" : "Afficher"} onClick={() => setVisible(v => !v)}>
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {setup && <>
            <label htmlFor="login-confirm">Confirmer le mot de passe</label>
            <input
              id="login-confirm" required type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmez votre mot de passe"
            />
          </>}

          <button className="compact-login-submit" type="submit" disabled={busy || browserPreview}>
            {busy ? "Vérification…" : setup ? "Créer le compte" : "Se connecter"}
            {busy ? <LockKeyhole size={17} /> : <Check size={17} />}
          </button>
        </form>

        <div className="compact-login-trust"><span><ShieldCheck size={14}/> Accès protégé</span><span><WifiOff size={14}/> Sans Internet</span></div>
      </div>
      <p className="compact-login-bottom">ModeStock Local · Gestion de boutique sur cet ordinateur</p>
    </main>
  );
}
