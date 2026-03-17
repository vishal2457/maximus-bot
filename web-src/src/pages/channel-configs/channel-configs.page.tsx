import { useState, useEffect } from "react";
import { Plus, Settings, Trash2, RefreshCw } from "lucide-react";
import {
  useChannelConfigs,
  useCreateChannelConfig,
  useUpdateChannelConfig,
  useDeleteChannelConfig,
  useDiscordChannels,
  useSyncChannels,
  useCreateDiscordChannel,
  type ChannelConfig,
  type CreateChannelConfigInput,
} from "../../lib/api/channel-configs";
import { useProjects } from "../../lib/api/projects";

const SYSTEM_PROMPT_PLACEHOLDER = `You are a specialized assistant focused on [specific task/domain].

Key behaviors:
- [Behavior 1]
- [Behavior 2]

Guidelines:
- [Guideline 1]
- [Guideline 2]`;

export function ChannelConfigsPage() {
  const { data: configs, isLoading: configsLoading } = useChannelConfigs();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const createMutation = useCreateChannelConfig();
  const updateMutation = useUpdateChannelConfig();
  const deleteMutation = useDeleteChannelConfig();
  const syncMutation = useSyncChannels();
  const createChannelMutation = useCreateDiscordChannel();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [channelMode, setChannelMode] = useState<"select" | "create">("select");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [formData, setFormData] = useState<CreateChannelConfigInput>({
    channelId: "",
    projectId: "",
    name: "",
    systemPrompt: "",
  });

  const { data: discordChannels, isLoading: channelsLoading } =
    useDiscordChannels(selectedProjectId || undefined);

  useEffect(() => {
    if (formData.projectId !== selectedProjectId) {
      setSelectedProjectId(formData.projectId);
    }
  }, [formData.projectId, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !editingId) {
      setFormData((prev) => {
        if (prev.projectId === selectedProjectId && prev.channelId) {
          return prev;
        }
        return { ...prev, channelId: "" };
      });
    }
  }, [selectedProjectId, editingId]);

  const isLoading = configsLoading || projectsLoading;

  const resetForm = () => {
    setFormData({
      channelId: "",
      projectId: "",
      name: "",
      systemPrompt: "",
    });
    setSelectedProjectId("");
    setIsCreating(false);
    setEditingId(null);
    setChannelMode("select");
    setNewChannelName("");
    setNewChannelTopic("");
  };

  const handleCreate = () => {
    setIsCreating(true);
    const firstProjectId = projects?.[0]?.id || "";
    setFormData({
      channelId: "",
      projectId: firstProjectId,
      name: "",
      systemPrompt: "",
    });
    setSelectedProjectId(firstProjectId);
    setChannelMode("select");
    setNewChannelName("");
    setNewChannelTopic("");
  };

  const handleEdit = (config: ChannelConfig) => {
    setEditingId(config.id);
    setFormData({
      channelId: config.channelId,
      projectId: config.projectId,
      name: config.name,
      systemPrompt: config.systemPrompt,
    });
    setSelectedProjectId(config.projectId);
  };

  const handleSave = async () => {
    if (!formData.projectId || !formData.name || !formData.systemPrompt) {
      return;
    }

    let channelId = formData.channelId;

    if (channelMode === "create") {
      if (!newChannelName.trim()) {
        return;
      }
      try {
        const createdChannel = await createChannelMutation.mutateAsync({
          projectId: formData.projectId,
          channelName: newChannelName.trim(),
          topic: newChannelTopic.trim() || undefined,
        });
        channelId = createdChannel.id;
      } catch (error) {
        console.error("Failed to create channel:", error);
        return;
      }
    } else {
      if (!channelId) {
        return;
      }
    }

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        input: {
          name: formData.name,
          systemPrompt: formData.systemPrompt,
        },
      });
    } else {
      await createMutation.mutateAsync({
        ...formData,
        channelId,
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm("Are you sure you want to delete this channel config?")
    ) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSync = async () => {
    await syncMutation.mutateAsync();
  };

  const getProjectName = (projectId: string): string => {
    return projects?.find((p) => p.id === projectId)?.name || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="border-b border-[#333] pb-4">
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            Channel Configs
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            SPECIALIZED CHANNEL PROMPTS
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 bg-[#0D0D0D] border border-[#333] animate-pulse"
            >
              <div className="h-6 w-6 bg-[#222] rounded mb-4" />
              <div className="h-8 w-3/4 bg-[#222] rounded mb-2" />
              <div className="h-10 w-full bg-[#222] rounded mb-6" />
              <div className="h-4 w-1/2 bg-[#222] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
              Channel Configs
            </h1>
            <p className="text-[#777] font-mono text-sm mt-1">
              SPECIALIZED CHANNEL PROMPTS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#333] text-white font-bold uppercase tracking-wide hover:bg-[#333]/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={syncMutation.isPending ? "animate-spin" : ""}
              />
              Sync Channels
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF4400] text-white font-bold uppercase tracking-wide hover:bg-[#FF4400]/80 transition-colors"
            >
              <Plus size={18} />
              New Config
            </button>
          </div>
        </div>
      </div>

      {isCreating || editingId ? (
        <div className="bg-[#0D0D0D] border border-[#333] p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {editingId ? "Edit Channel Config" : "Create Channel Config"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#CCC] uppercase tracking-wide mb-2">
                Config Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
                placeholder="e.g., CodeReview Bot"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#CCC] uppercase tracking-wide mb-2">
                Project
              </label>
              <select
                value={formData.projectId}
                onChange={(e) =>
                  setFormData({ ...formData, projectId: e.target.value })
                }
                className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
              >
                <option value="">Select a project</option>
                {projects?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#CCC] uppercase tracking-wide mb-2">
                Discord Channel
              </label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channelMode"
                    checked={channelMode === "select"}
                    onChange={() => setChannelMode("select")}
                    className="accent-[#FF4400]"
                  />
                  <span className="text-sm text-[#CCC]">Select Existing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channelMode"
                    checked={channelMode === "create"}
                    onChange={() => setChannelMode("create")}
                    className="accent-[#FF4400]"
                  />
                  <span className="text-sm text-[#CCC]">Create New</span>
                </label>
              </div>

              {channelMode === "select" ? (
                channelsLoading ? (
                  <div className="p-3 bg-[#050505] border border-[#222] text-[#777]">
                    Loading channels...
                  </div>
                ) : discordChannels && discordChannels.length > 0 ? (
                  <select
                    value={formData.channelId}
                    onChange={(e) =>
                      setFormData({ ...formData, channelId: e.target.value })
                    }
                    className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
                  >
                    <option value="">Select a channel</option>
                    {discordChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        #{channel.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.channelId}
                    onChange={(e) =>
                      setFormData({ ...formData, channelId: e.target.value })
                    }
                    className="w-full p-3 bg-[#050505] border border-[#222] text-white font-mono focus:border-[#FF4400] focus:outline-none"
                    placeholder="Enter channel ID (e.g., 123456789012345678)"
                  />
                )
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
                    placeholder="Channel name (e.g., my-new-channel)"
                  />
                  <input
                    type="text"
                    value={newChannelTopic}
                    onChange={(e) => setNewChannelTopic(e.target.value)}
                    className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
                    placeholder="Channel topic (optional)"
                  />
                  {createChannelMutation.isPending && (
                    <p className="text-xs text-[#FF4400]">
                      Creating channel...
                    </p>
                  )}
                </div>
              )}

              {channelMode === "select" && !formData.projectId && (
                <p className="text-xs text-[#777] mt-1">
                  Select a project first to see available channels
                </p>
              )}
              {channelMode === "select" &&
                formData.projectId &&
                (!discordChannels || discordChannels.length === 0) &&
                !channelsLoading && (
                  <p className="text-xs text-[#777] mt-1">
                    No channels found. Click "Sync Channels" above to sync
                    Discord channels.
                  </p>
                )}
            </div>
            <div>
              <label className="block text-sm font-bold text-[#CCC] uppercase tracking-wide mb-2">
                System Prompt
              </label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) =>
                  setFormData({ ...formData, systemPrompt: e.target.value })
                }
                rows={10}
                className="w-full p-3 bg-[#050505] border border-[#222] text-white font-mono text-sm focus:border-[#FF4400] focus:outline-none resize-y"
                placeholder={SYSTEM_PROMPT_PLACEHOLDER}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={
                  (channelMode === "select" && !formData.channelId) ||
                  (channelMode === "create" && !newChannelName.trim()) ||
                  !formData.projectId ||
                  !formData.name ||
                  !formData.systemPrompt ||
                  createChannelMutation.isPending
                }
                className="px-4 py-2 bg-[#00FF41] text-black font-bold uppercase tracking-wide hover:bg-[#00FF41]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "Update" : "Create"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-[#333] text-white font-bold uppercase tracking-wide hover:bg-[#333]/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {configs?.map((config) => (
          <div
            key={config.id}
            className="group relative p-5 bg-[#0D0D0D] border border-[#333] hover:border-[#FF4400] transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[#777] group-hover:text-[#FF4400] transition-colors">
                <Settings size={24} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(config)}
                  className="text-[#777] hover:text-[#CCC] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  className="text-[#777] hover:text-[#FF4400] transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white uppercase tracking-wide mb-2">
              {config.name}
            </h3>

            <div className="text-xs text-[#777] mb-4 font-mono">
              <div className="truncate">Channel: {config.channelId}</div>
              <div className="truncate">
                Project: {getProjectName(config.projectId)}
              </div>
            </div>

            <div className="border-t border-[#222] pt-4">
              <p className="text-sm text-[#CCC] line-clamp-4 font-mono">
                {config.systemPrompt.length > 200
                  ? `${config.systemPrompt.slice(0, 200)}...`
                  : config.systemPrompt}
              </p>
            </div>
          </div>
        ))}

        {configs?.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12">
            <Settings size={48} className="mx-auto mb-4 text-[#555]" />
            <p className="text-[#777] font-mono">
              No channel configs yet. Create one to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
