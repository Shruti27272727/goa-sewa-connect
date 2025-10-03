import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  description: string;
  fee: number;
  required_documents: string[];
  departments: {
    name: string;
  };
}

const ApplyService = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<{ [key: string]: File }>({});

  useEffect(() => {
    fetchService();
  }, [serviceId]);

  const fetchService = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          *,
          departments (name)
        `)
        .eq("id", serviceId)
        .single();

      if (error) throw error;
      setService(data);
    } catch (error) {
      console.error("Error fetching service:", error);
      toast.error("Failed to load service details");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (docType: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [docType]: file }));
    } else {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[docType];
        return newFiles;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!service) return;

    // Check if all required documents are uploaded
    const missingDocs = service.required_documents.filter(doc => !files[doc]);
    if (missingDocs.length > 0) {
      toast.error(`Please upload: ${missingDocs.join(", ")}`);
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create application
      const { data: application, error: appError } = await supabase
        .from("applications")
        .insert({
          citizen_id: user.id,
          service_id: service.id,
          status: "pending",
        })
        .select()
        .single();

      if (appError) throw appError;

      // Upload documents
      for (const [docType, file] of Object.entries(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${application.id}/${docType}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("application-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("application-documents")
          .getPublicUrl(fileName);

        // Create document record
        const { error: docError } = await supabase
          .from("documents")
          .insert({
            application_id: application.id,
            file_name: file.name,
            file_url: publicUrl,
            doc_type: docType,
          });

        if (docError) throw docError;
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          application_id: application.id,
          amount: service.fee,
          status: "completed", // Mock payment completion
          payment_method: "mock",
          paid_at: new Date().toISOString(),
        });

      if (paymentError) throw paymentError;

      toast.success("Application submitted successfully!");
      navigate("/");
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!service) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{service.name}</CardTitle>
            <CardDescription>{service.departments.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-muted-foreground">{service.description}</p>
            </div>

            <div className="flex justify-between p-4 bg-muted rounded-lg">
              <span className="font-medium">Service Fee:</span>
              <span className="text-xl font-bold">₹{service.fee}</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Required Documents</h3>
                <div className="space-y-4">
                  {service.required_documents.map((doc) => (
                    <div key={doc} className="space-y-2">
                      <Label htmlFor={doc}>{doc}</Label>
                      <div className="flex gap-2">
                        <Input
                          id={doc}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(doc, e.target.files?.[0] || null)}
                          required
                        />
                        {files[doc] && (
                          <div className="flex items-center text-sm text-success">
                            <FileText className="h-4 w-4 mr-1" />
                            Uploaded
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <h4 className="font-semibold">Payment Information</h4>
                <p className="text-sm text-muted-foreground">
                  Payment of ₹{service.fee} will be processed automatically upon submission.
                  This is a demo - no actual payment will be charged.
                </p>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit Application & Pay ₹{service.fee}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default function ApplyServiceWithGuard() {
  return (
    <AuthGuard requiredRole="citizen">
      <ApplyService />
    </AuthGuard>
  );
}
