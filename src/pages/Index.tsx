import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check user roles and redirect appropriately
    try {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];

      if (roles.length === 0) {
        navigate("/auth");
      } else if (roles.length === 1) {
        // Auto-redirect to appropriate dashboard
        switch (roles[0]) {
          case "citizen":
            navigate("/citizen");
            break;
          case "officer":
            navigate("/officer");
            break;
          case "admin":
            navigate("/admin");
            break;
          default:
            navigate("/auth");
        }
      } else {
        // Multiple roles - show selector
        navigate("/select-role");
      }
    } catch (error) {
      console.error("Error checking roles:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
}
