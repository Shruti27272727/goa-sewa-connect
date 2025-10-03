import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, FileText, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Application {
  id: string;
  status: string;
  applied_on: string;
  remarks: string | null;
  services: {
    name: string;
    fee: number;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

const OfficerDashboard = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          applied_on,
          remarks,
          citizen_id,
          services (name, fee)
        `)
        .order("applied_on", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const applicationsWithProfiles = await Promise.all(
        (data || []).map(async (app) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", app.citizen_id)
            .single();
          
          return {
            ...app,
            profiles: profile || { full_name: "Unknown", email: "N/A" }
          };
        })
      );

      setApplications(applicationsWithProfiles);
      return;

    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (appId: string, newStatus: string) => {
    setProcessingId(appId);
    try {
      const updateData: any = {
        status: newStatus,
        remarks: remarks[appId] || null,
      };

      if (newStatus === "approved" || newStatus === "rejected") {
        updateData.completed_on = new Date().toISOString();
      }

      const { error } = await supabase
        .from("applications")
        .update(updateData)
        .eq("id", appId);

      if (error) throw error;

      toast.success(`Application ${newStatus}`);
      fetchApplications();
      setRemarks(prev => ({ ...prev, [appId]: "" }));
    } catch (error) {
      console.error("Error updating application:", error);
      toast.error("Failed to update application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success/10 text-success border-success/20";
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "pending":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground";
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">Officer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Goa Government Services</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Applications</h2>
          <p className="text-muted-foreground">Review and process citizen applications</p>
        </div>

        {applications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No applications to review</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle>{app.services.name}</CardTitle>
                      <CardDescription>
                        Applicant: {app.profiles.full_name} ({app.profiles.email})
                      </CardDescription>
                      <CardDescription>
                        Applied: {new Date(app.applied_on).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(app.status)}>
                      {app.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Fee:</span>
                    <span className="font-semibold">₹{app.services.fee}</span>
                  </div>

                  {app.remarks && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium mb-1">Previous Remarks:</p>
                      <p className="text-sm text-muted-foreground">{app.remarks}</p>
                    </div>
                  )}

                  {app.status === "pending" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Add Remarks (Optional)</label>
                        <Textarea
                          placeholder="Add any notes or comments..."
                          value={remarks[app.id] || ""}
                          onChange={(e) => setRemarks(prev => ({ ...prev, [app.id]: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-success hover:bg-success/90"
                          onClick={() => handleUpdateStatus(app.id, "approved")}
                          disabled={processingId === app.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          className="flex-1"
                          variant="destructive"
                          onClick={() => handleUpdateStatus(app.id, "rejected")}
                          disabled={processingId === app.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default function OfficerDashboardWithGuard() {
  return (
    <AuthGuard requiredRole="officer">
      <OfficerDashboard />
    </AuthGuard>
  );
}
