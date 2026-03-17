import { MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { useSecrets } from "../../lib/api/secrets";

export const IntegrationsPage = () => {
  const { data: secrets } = useSecrets();

  const discordConfigured = !!(
    secrets?.discord_bot_token &&
    secrets?.discord_guild_id &&
    secrets?.discord_application_id &&
    secrets?.discord_public_key &&
    secrets?.discord_webhook_url
  );

  const integration = {
    id: "discord",
    name: "Discord",
    status: discordConfigured
      ? ("connected" as const)
      : ("disconnected" as const),
    icon: "discord",
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "discord":
        return <MessageSquare size={24} className="text-white" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            Comms Link
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            EXTERNAL CHANNEL BINDINGS
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          key={integration.id}
          className="group relative p-6 bg-[#0D0D0D] border border-[#333] hover:border-[#555] transition-colors flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-[#222] border border-[#444]">
              {getIcon(integration.icon)}
            </div>
            <div
              className={`flex items-center gap-2 px-2 py-1 text-xs font-bold tracking-widest uppercase border ${
                integration.status === "connected"
                  ? "border-[#00FF41]/30 text-[#00FF41] bg-[#00FF41]/10"
                  : "border-[#555] text-[#777] bg-[#222]"
              }`}
            >
              {integration.status === "connected" ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )}
              <span>{integration.status}</span>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white uppercase tracking-wide mb-2">
              {integration.name}
            </h3>
            <p className="text-sm font-mono text-[#777] mb-6">
              Route agent notifications and command inputs via{" "}
              {integration.name} API.
            </p>
          </div>

          <button
            className={`w-full py-2 font-bold uppercase tracking-widest transition-colors border ${
              integration.status === "connected"
                ? "border-[#FF4400] text-[#FF4400] hover:bg-[#FF4400] hover:text-black"
                : "border-[#333] text-[#CCC] hover:border-white hover:bg-white hover:text-black"
            }`}
          >
            {integration.status === "connected"
              ? "Sever Link"
              : "Establish Link"}
          </button>
        </div>
      </div>
    </div>
  );
};
