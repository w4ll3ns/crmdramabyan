// Supabase-backed auth wrapper. Keeps a small, app-specific API surface
// so the rest of the UI does not depend on Supabase types directly.
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translate(error.message));
}

export async function signUpWithEmail(email: string, password: string) {
  const redirect =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirect },
  });
  if (error) throw new Error(translate(error.message));
}

export async function signInWithGoogle() {
  if (typeof window === "undefined") return;
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) throw new Error(translate(result.error.message));
}

export async function resetPassword(email: string) {
  if (!email) throw new Error("Informe seu e-mail.");
  const redirect =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirect,
  });
  if (error) throw new Error(translate(error.message));
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(translate(error.message));
}

export async function signOut() {
  await supabase.auth.signOut();
}

function translate(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("user already registered"))
    return "Já existe uma conta com este e-mail.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail para continuar.";
  return msg;
}
