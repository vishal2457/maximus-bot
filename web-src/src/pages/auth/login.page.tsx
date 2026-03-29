import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setupUser, login } from "../../lib/api/auth";
import { updateSocketAuth } from "../../lib/socket";
import { toast } from "sonner";
import { Terminal, KeyRound } from "lucide-react";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [isSetup, setIsSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let tokens;
      if (isSetup) {
        tokens = await setupUser({ username, password, displayName });
      } else {
        tokens = await login({ username, password });
      }

      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      if (tokens.user) {
        localStorage.setItem("user", JSON.stringify(tokens.user));
      }

      updateSocketAuth();
      toast.success(isSetup ? "Setup complete" : "Logged in");
      navigate("/");
    } catch (err: any) {
      const msg =
        err?.response?.data?.msg || err?.message || "Authentication failed";
      setError(msg);

      if (msg.includes("Setup already completed")) {
        setIsSetup(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-[#FF4400] mb-4">
            <Terminal size={32} />
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-wider text-white">
            MAXIMUS
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            CODING AGENT INTERFACE
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#0D0D0D] border border-[#333] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={16} className="text-[#FF4400]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#777]">
              {isSetup ? "Initial Setup" : "Login"}
            </span>
          </div>

          {error && (
            <div className="bg-[#FF4400]/10 border border-[#FF4400]/30 text-[#FF4400] px-3 py-2 text-sm font-mono">
              {error}
            </div>
          )}

          {isSetup && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#777] mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-[#111] border border-[#333] text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF4400]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#777] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
              className="w-full bg-[#111] border border-[#333] text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF4400]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#777] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-[#111] border border-[#333] text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF4400]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#FF4400] text-black font-bold uppercase tracking-widest hover:bg-[#FF6633] disabled:opacity-50 transition-colors"
          >
            {loading ? "Processing..." : isSetup ? "Create Account" : "Login"}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSetup(!isSetup);
              setError("");
            }}
            className="w-full text-xs text-[#777] hover:text-[#FF4400] font-mono transition-colors"
          >
            {isSetup
              ? "Already have an account? Login"
              : "First time? Setup account"}
          </button>
        </form>
      </div>
    </div>
  );
};
