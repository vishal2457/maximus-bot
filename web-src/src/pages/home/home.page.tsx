import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">Maximus Bot</h1>
      <Button onClick={() => navigate("/handle-secrets")}>
        Configure Secrets
      </Button>
      <Button variant="outline" onClick={() => navigate("/logs")}>
        View Logs
      </Button>
    </div>
  );
};
