import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
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

  useEffect(() => {
    fetchSecrets();
  }, []);

  const fetchSecrets = async () => {
    try {
      const response = await fetch("/api/secrets");
      if (!response.ok) {
        throw new Error("Failed to fetch secrets");
      }
      const data = await response.json();
      for (const key of SECRET_KEYS) {
        setValue(key, data[key] || "");
      }
    } catch (error) {
      console.error("Error fetching secrets:", error);
      toast.error("Failed to load Discord configuration");
    }
  };

  const onSubmit = async (data: DiscordSecretsForm) => {
    try {
      for (const key of SECRET_KEYS) {
        const value = data[key];
        if (value) {
          const response = await fetch("/api/secrets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
          });
          if (!response.ok) {
            throw new Error(`Failed to save ${key}`);
          }
        }
      }
      toast.success("Discord configuration saved");
    } catch (error) {
      console.error("Error saving secrets:", error);
      toast.error("Failed to save configuration");
    }
  };

  return (
    <div className="p-6 w-full max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Discord Configuration</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bot Credentials</CardTitle>
          <CardDescription>
            Configure your Discord bot credentials. These will be stored
            securely in your system keychain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {SECRET_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{SECRET_LABELS[key]}</Label>
                <Input
                  id={key}
                  type="password"
                  {...register(key)}
                  placeholder={`Enter ${SECRET_LABELS[key].toLowerCase()}`}
                  aria-invalid={!!errors[key]}
                />
                {errors[key] && (
                  <p className="text-sm text-destructive">
                    {errors[key]?.message}
                  </p>
                )}
              </div>
            ))}
            <Button type="submit" disabled={isSubmitting} className="mt-4">
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
