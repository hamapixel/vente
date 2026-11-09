import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Shirt, WifiOff } from "lucide-react";
import { api } from "./api";
import type { UserSession } from "./types";

interface Props {
  setup: boolean;
  onSuccess: (user: UserSession) => void;
  browserPreview: boolean;
}

export default function LoginScreen({ setup, onSuccess, browserPreview }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (browserPreview || busy) return;
    if (setup && password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setBusy(true); setError("");
    try {
      const session = setup
        ? await api.registerAdmin(username, password)
        : await api.login(username, password);
      onSuccess(session);
    } catch (err) {
      setError(typeof err === "string" ? err : "Impossible de se connecter.");
    } finally { setBusy(false); }
  }

  return <div className="login-screen">
    <div className="login-side">
      <div className="login-brand"><span className="brand-mark"><Shirt size={25}/></span><strong>ModeStock <span>Local</span></strong></div>
      <div className="login-promo"><span className="login-kicker">VOTRE BOUTIQUE, SIMPLIFIÉE.</span><h1>Vendez mieux.<br/>Gérez simplement.</h1><p>Vos ventes, vos vêtements, vos bénéfices et vos reçus, réunis dans une application élégante et entièrement locale.</p><div className="login-features"><span><ShieldCheck size={17}/> Données conservées sur cet ordinateur</span><span><WifiOff size={17}/> Fonctionnement sans Internet</span></div></div>
      <small>ModeStock Local · Gestion commerciale</small>
    </div>
    <div className="login-main"><form className="login-form" onSubmit={submit}>
      <div className="login-lock"><LockKeyhole size={24}/></div>
      <span className="eyebrow">{setup ? "CONFIGURATION INITIALE" : "ESPACE SÉCURISÉ"}</span>
      <h2>{setup ? "Créer le compte administrateur" : "Connexion à votre boutique"}</h2>
      <p>{setup ? "Créez votre identifiant et un mot de passe pour protéger la gestion de votre boutique." : "Identifiez-vous pour accéder à la caisse et à vos données locales."}</p>
      {browserPreview && <div className="auth-error">L'authentification fonctionne uniquement dans la fenêtre Windows de Tauri. Lancez npm run tauri dev.</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <label>Identifiant<input required autoFocus minLength={setup ? 3 : undefined} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ex. administrateur" /></label>
      <label>Mot de passe<div className="password-wrap"><input required minLength={setup ? 8 : undefined} maxLength={128} autoComplete={setup ? "new-password" : "current-password"} type={visible ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Votre mot de passe" /><button type="button" aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={()=>setVisible(v=>!v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
      {setup && <label>Confirmer le mot de passe<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirmer le mot de passe" /></label>}
      <button className="primary-btn full-width" disabled={busy || browserPreview} type="submit">{busy ? "Vérification…" : setup ? "Créer mon compte" : "Se connecter"}</button>
      <small className="login-privacy">Aucun compte en ligne nécessaire. Conservez votre mot de passe : la récupération automatique n'est pas encore disponible.</small>
    </form></div>
  </div>;
}
