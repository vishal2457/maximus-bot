import { useState, useEffect } from "react";

export const LogsPage = () => {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [logType, setLogType] = useState<"debug" | "error">("debug");

  useEffect(() => {
    fetchLogs();
  }, [logType]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/logs/${logType}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      setLogs(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLogs("");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  const handleLogTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLogType(e.target.value as "debug" | "error");
  };

  return (
    <div className="p-6 w-full max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Log Viewer</h1>

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="log-type" className="text-sm font-medium">
          Log Type:
        </label>
        <select
          id="log-type"
          value={logType}
          onChange={handleLogTypeChange}
          className="border border-gray-600 rounded px-3 py-1 bg-gray-800 text-white"
        >
          <option value="debug">Debug</option>
          <option value="error">Error</option>
        </select>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-300">
          Error: {error}
        </div>
      )}

      <div className="border border-gray-700 rounded bg-gray-900 p-4 h-96 overflow-auto">
        <pre className="text-sm text-green-400 whitespace-pre-wrap">{logs}</pre>
      </div>
    </div>
  );
};
