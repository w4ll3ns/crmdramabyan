import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "admin",
      });
      if (mounted) setIsAdmin(!error && !!data);
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return isAdmin;
}
