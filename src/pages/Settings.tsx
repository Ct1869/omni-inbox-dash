import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BulkAccountImport } from "@/components/dashboard/BulkAccountImport";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Home, Settings as SettingsIcon } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => navigate("/dashboard/gmail")}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
          <ChevronRight className="h-4 w-4" />
          <div className="flex items-center gap-1 text-foreground font-medium">
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </div>
        </nav>

        {/* Back Button (Alternative Navigation) */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/gmail")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your email accounts and application settings
            </p>
          </div>

          <BulkAccountImport />
        </div>
      </div>
    </div>
  );
};

export default Settings;

