import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSecrets, useSaveSecret } from "@/lib/api";
import { KeyRound, Eye, EyeOff, Plus, Copy, ShieldAlert } from "lucide-react";

const discordSecretsSchema = z.object({
  discord_bot_token: z.string().min(1, "Bot Token is required"),
  discord_guild_id: z.string().min(1, "Guild ID is required"),
  discord_application_id: z.string().min(1, "Application ID is required"),
  discord_public_key: z.string().min(1, "Public Key is required"),
  discord_webhook_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

type DiscordSecretsForm = z.infer<typeof discordSecretsSchema>;

const SECRET_LABELS: Record<keyof DiscordSecretsForm, string> = {
  discord_bot_token: "Bot Token",
  discord_guild_id: "Guild ID",
  discord_application_id: "Application ID",
  discord_public_key: "Public Key",
  discord_webhook_url: "Webhook URL",
};

const SECRET_KEYS: (keyof DiscordSecretsForm)[] = [
  "discord_bot_token",
  "discord_guild_id",
  "discord_application_id",
  "discord_public_key",
  "discord_webhook_url",
];

export const DiscordConfigPage = () => {
  const { data: secrets } = useSecrets();
  const saveSecretMutation = useSaveSecret();
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {},
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DiscordSecretsForm>({
    resolver: zodResolver(discordSecretsSchema),
    defaultValues: {
      discord_bot_token: "",
      discord_guild_id: "",
      discord_application_id: "",
      discord_public_key: "",
      discord_webhook_url: "",
    },
  });

  if (secrets && Object.keys(secrets).length > 0) {
    const formValues: DiscordSecretsForm = {
      discord_bot_token: secrets.discord_bot_token || "",
      discord_guild_id: secrets.discord_guild_id || "",
      discord_application_id: secrets.discord_application_id || "",
      discord_public_key: secrets.discord_public_key || "",
      discord_webhook_url: secrets.discord_webhook_url || "",
    };
    reset(formValues);
  }

  const onSubmit = async (data: DiscordSecretsForm) => {
    try {
      for (const key of SECRET_KEYS) {
        const value = data[key];
        if (value) {
          await saveSecretMutation.mutateAsync({ key, value });
        }
      }
      toast.success("Discord configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            Vault
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            ENCRYPTED ENVIRONMENT VARIABLES
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-[#FF4400] text-[#FF4400] hover:bg-[#FF4400] hover:text-black font-bold uppercase tracking-wider transition-colors">
          <Plus size={18} />
          Inject Secret
        </button>
      </div>

      <div className="p-4 bg-[#F2A900]/10 border border-[#F2A900]/30 flex items-start gap-3">
        <ShieldAlert size={20} className="text-[#F2A900] shrink-0 mt-0.5" />
        <p className="text-sm text-[#F2A900] font-mono uppercase tracking-wide">
          WARNING: Secrets are decrypted in memory only. Do not expose local
          vault files.
        </p>
      </div>

      <div className="p-6 bg-[#0D0D0D] border border-[#333]">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6">
          Discord Configuration
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {SECRET_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#050505] border border-[#222] hover:border-[#333] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="text-[#555]">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-mono tracking-wider">
                    {SECRET_LABELS[key]}
                  </h3>
                  <p className="text-xs font-mono text-[#555] mt-1">{key}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1 sm:max-w-md">
                <div className="flex items-center bg-[#050505] border border-[#222] px-3 py-2 flex-1">
                  <Input
                    id={key}
                    type={visibleSecrets[key] ? "text" : "password"}
                    {...register(key)}
                    placeholder={`Enter ${SECRET_LABELS[key].toLowerCase()}`}
                    className="bg-transparent border-0 text-[#00FF41] font-mono tracking-widest focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(key)}
                    className="text-[#555] hover:text-white transition-colors ml-auto"
                  >
                    {visibleSecrets[key] ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-2 text-[#555] hover:text-white hover:bg-[#222] transition-colors"
                    title="Copy"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {errors && Object.keys(errors).length > 0 && (
            <div className="p-4 bg-[#FF4400]/10 border border-[#FF4400]/30">
              {Object.values(errors).map((error, i) => (
                <p key={i} className="text-sm text-[#FF4400] font-mono">
                  {error.message}
                </p>
              ))}
            </div>
          )}

          <Button
            type="submit"
            disabled={saveSecretMutation.isPending}
            className="w-full py-3 bg-[#FF4400] hover:bg-[#FF4400]/90 text-black font-bold uppercase tracking-wider"
          >
            {saveSecretMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </form>
      </div>
    </div>
  );
};
