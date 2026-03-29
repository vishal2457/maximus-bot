import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Bot, Trash2, RefreshCw } from "lucide-react";
import {
  useChannelConfigsByProjectId,
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

export function AgentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const project = projects?.find((p) => p.id === projectId);

  const { data: agents, isLoading: agentsLoading } =
    useChannelConfigsByProjectId(projectId || "");
  const createMutation = useCreateChannelConfig();
  const updateMutation = useUpdateChannelConfig();
  const deleteMutation = useDeleteChannelConfig();
  const syncMutation = useSyncChannels();
  const createChannelMutation = useCreateDiscordChannel();

  const { data: discordChannels, isLoading: channelsLoading } =
    useDiscordChannels(projectId);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [channelMode, setChannelMode] = useState<"select" | "create">("select");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [formData, setFormData] = useState<
    Omit<CreateChannelConfigInput, "projectId">
  >({
    channelId: "",
    name: "",
    systemPrompt: "",
  });

  const isLoading = agentsLoading || !project;

  const resetForm = () => {
    setFormData({
      channelId: "",
      name: "",
      systemPrompt: "",
    });
    setIsCreating(false);
    setEditingId(null);
    setChannelMode("select");
    setNewChannelName("");
    setNewChannelTopic("");
  };

  const handleCreate = () => {
    setFormData({
      channelId: "",
      name: "",
      systemPrompt: "",
    });
    setIsCreating(true);
    setChannelMode("select");
    setNewChannelName("");
    setNewChannelTopic("");
  };

  const handleEdit = (agent: ChannelConfig) => {
    setEditingId(agent.id);
    setFormData({
      channelId: agent.channelId,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
    });
  };

  const handleSave = async () => {
    if (!projectId || !formData.name || !formData.systemPrompt) {
      return;
    }

    let channelId = formData.channelId;

    if (channelMode === "create") {
      if (!newChannelName.trim()) {
        return;
      }
      try {
        const createdChannel = await createChannelMutation.mutateAsync({
          projectId,
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
        projectId,
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleSync = async () => {
    await syncMutation.mutateAsync();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="border-b border-[#333] pb-4">
          <div className="h-10 w-48 bg-[#222] rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-[#222] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 bg-[#0D0D0D] border border-[#333] animate-pulse"
            >
              <div className="h-6 w-6 bg-[#222] rounded mb-4" />
              <div className="h-8 w-3/4 bg-[#222] rounded mb-2" />
              <div className="h-10 w-full bg-[#222] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/project")}
              className="flex items-center gap-2 text-[#777] hover:text-[#FF4400] transition-colors mb-2"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-mono">Back to Projects</span>
            </button>
            <h1 className="text-2xl md:text-4xl font-bold uppercase tracking-wider text-white">
              {project?.name} Agents
            </h1>
            <p className="text-[#777] font-mono text-sm mt-1">
              AI AGENTS FOR THIS PROJECT
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
              New Agent
            </button>
          </div>
        </div>
      </div>

      {isCreating || editingId ? (
        <div className="bg-[#0D0D0D] border border-[#333] p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {editingId ? "Edit Agent" : "Create Agent"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#CCC] uppercase tracking-wide mb-2">
                Agent Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full p-3 bg-[#050505] border border-[#222] text-white focus:border-[#FF4400] focus:outline-none"
                placeholder="e.g., CodeReview Agent"
              />
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

              {channelMode === "select" &&
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
        {agents?.map((agent) => (
          <div
            key={agent.id}
            className="group relative p-5 bg-[#0D0D0D] border border-[#333] hover:border-[#FF4400] transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-[#777] group-hover:text-[#FF4400] transition-colors">
                <Bot size={24} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(agent)}
                  className="text-[#777] hover:text-[#CCC] transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="text-[#777] hover:text-[#FF4400] transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white uppercase tracking-wide mb-2">
              {agent.name}
            </h3>

            <div className="text-xs text-[#777] mb-4 font-mono truncate">
              Channel: #
              {discordChannels?.find((c) => c.id === agent.channelId)?.name ||
                agent.channelId}
            </div>

            <div className="border-t border-[#222] pt-4">
              <p className="text-sm text-[#CCC] line-clamp-4 font-mono">
                {agent.systemPrompt.length > 200
                  ? `${agent.systemPrompt.slice(0, 200)}...`
                  : agent.systemPrompt}
              </p>
            </div>
          </div>
        ))}

        {agents?.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12">
            <Bot size={48} className="mx-auto mb-4 text-[#555]" />
            <p className="text-[#777] font-mono">
              No agents configured for this project.
            </p>
            <p className="text-[#555] font-mono text-sm mt-1">
              Click "New Agent" to create one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
