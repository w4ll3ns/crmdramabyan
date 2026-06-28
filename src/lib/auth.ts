// Lightweight local auth shim until Lovable Cloud is enabled.
// Persists a "session" in localStorage so the UI flow works end-to-end.

const KEY = "mabyan.session.v1";

export type Session = { email: string; createdAt: number };

type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();

export const auth = {
  getSession(): Session | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  async signIn(email: string, password: string): Promise<Session> {
    if (!email || !password || password.length < 6) {
      throw new Error("E-mail ou senha inválidos.");
    }
    const s: Session = { email, createdAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(s));
    listeners.forEach((l) => l(s));
    return s;
  },
  async signUp(email: string, password: string) {
    return this.signIn(email, password);
  },
  async signOut() {
    window.localStorage.removeItem(KEY);
    listeners.forEach((l) => l(null));
  },
  async resetPassword(email: string) {
    if (!email) throw new Error("Informe seu e-mail.");
    return true;
  },
  onChange(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
