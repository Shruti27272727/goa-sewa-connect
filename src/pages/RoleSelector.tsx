import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Settings } from "lucide-react";
import { toast } from "sonner";

export default function RoleSelector() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    checkUserRoles();
  }, []);

  const checkUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      const rolesList = userRoles?.map(r => r.role) || [];
      
      if (rolesList.length === 0) {
        toast.error("No role assigned. Please contact administrator.");
        return;
      }

      setRoles(rolesList);

      // Auto-redirect if user has only one role
      if (rolesList.length === 1) {
        redirectToRole(rolesList[0]);
      }
    } catch (error) {
      console.error("Error checking roles:", error);
      toast.error("Failed to check user roles");
    } finally {
      setLoading(false);
    }
  };

  const redirectToRole = (role: string) => {
    switch (role) {
      case "citizen":
        navigate("/");
        break;
      case "officer":
        navigate("/officer");
        break;
      case "admin":
        navigate("/admin");
        break;
      default:
        toast.error("Invalid role");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Your Role</CardTitle>
          <CardDescription>Choose how you want to access the portal</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {roles.includes("citizen") && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => redirectToRole("citizen")}>
              <CardHeader className="text-center">
                <Users className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Citizen</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">Apply for services and track applications</p>
              </CardContent>
            </Card>
          )}

          {roles.includes("officer") && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => redirectToRole("officer")}>
              <CardHeader className="text-center">
                <Shield className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Officer</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">Review and process applications</p>
              </CardContent>
            </Card>
          )}

          {roles.includes("admin") && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => redirectToRole("admin")}>
              <CardHeader className="text-center">
                <Settings className="h-12 w-12 mx-auto text-primary mb-2" />
                <CardTitle>Admin</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">Manage system and view reports</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
