import React, { useState } from 'react';
import { WebhookRequest, WebhookSettings } from '../App';

interface SidebarProps {
  requests: WebhookRequest[];
  selectedRequest: WebhookRequest | null;
  onSelectRequest: (request: WebhookRequest) => void;
  webhookSettings: WebhookSettings;
  onStartWebhook: () => void;
  onStopWebhook: () => void;
  onClearRequests: () => void;
  onPortChange: (port: number) => void;
  onTunnelToggle: (enabled: boolean) => void;
  tunnelEnabled: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  requests,
  selectedRequest,
  onSelectRequest,
  webhookSettings,
  onStartWebhook,
  onStopWebhook,
  onClearRequests,
  onPortChange,
  onTunnelToggle,
  tunnelEnabled,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const getMethodColor = (method: string) => {
    const colors = {
      GET: 'text-green-400',
      POST: 'text-blue-400',
      PUT: 'text-yellow-400',
      DELETE: 'text-red-400',
      PATCH: 'text-purple-400',
    };
    return colors[method as keyof typeof colors] || 'text-gray-400';
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleStartStop = async () => {
    setIsLoading(true);
    try {
      if (webhookSettings.isRunning) {
        await onStopWebhook();
      } else {
        await onStartWebhook();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-80 bg-sidebar-bg border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary mb-4">
          HookDesk
        </h1>
        
        {/* Port Settings */}
        <div className="mb-4">
          <label className="block text-sm text-text-secondary mb-2">
            Port
          </label>
          <input
            type="number"
            value={webhookSettings.port}
            onChange={(e) => onPortChange(parseInt(e.target.value) || 8080)}
            className="w-full px-3 py-2 bg-dark-bg border border-border rounded text-text-primary focus:outline-none focus:border-accent"
            disabled={webhookSettings.isRunning || isLoading}
          />
        </div>

        {/* Status and Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                webhookSettings.isRunning ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span className="text-sm text-text-secondary">
              {webhookSettings.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <button
            onClick={handleStartStop}
            disabled={isLoading}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isLoading
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : webhookSettings.isRunning
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-accent hover:bg-accent-hover text-white'
            }`}
          >
            {isLoading 
              ? (webhookSettings.isRunning ? 'Stopping...' : 'Starting...') 
              : (webhookSettings.isRunning ? 'Stop' : 'Start')
            }
          </button>
        </div>

        {/* URLs */}
        {webhookSettings.isRunning && (
          <div className="mb-4 space-y-3">
            {/* Local URL - Her zaman göster */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Local URL
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={`http://localhost:${webhookSettings.port}`}
                  readOnly
                  className="flex-1 px-3 py-2 bg-dark-bg border border-border rounded-l text-text-primary focus:outline-none text-sm"
                  style={{ fontSize: '12px' }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(`http://localhost:${webhookSettings.port}`)}
                  className="px-3 py-2 bg-accent hover:bg-accent-hover border border-accent rounded-r text-white transition-colors text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Public URL - Sadece tunnel aktifse göster */}
            {tunnelEnabled && webhookSettings.publicUrl && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Public URL (Tunnel)
                </label>
                <div className="flex">
                  <input
                    type="text"
                    value={webhookSettings.publicUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-dark-bg border border-border rounded-l text-text-primary focus:outline-none text-sm"
                    style={{ fontSize: '12px' }}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(webhookSettings.publicUrl)}
                    className="px-3 py-2 bg-accent hover:bg-accent-hover border border-accent rounded-r text-white transition-colors text-sm"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  You can send webhooks from outside using this URL
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tunnel Toggle */}
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm text-text-secondary">
            Tunnel
          </label>
          <input
            type="checkbox"
            checked={tunnelEnabled}
            onChange={(e) => onTunnelToggle(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 text-accent focus:ring-accent disabled:opacity-50"
          />
        </div>

        {/* Clear Button */}
        <button
          onClick={onClearRequests}
          disabled={requests.length === 0}
          className={`w-full px-3 py-2 rounded transition-colors ${
            requests.length === 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          Clear Requests ({requests.length})
        </button>
      </div>

      {/* Requests List */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-text-secondary">
            Incoming Requests ({requests.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, maxHeight: 'calc(100vh - 400px)' }}>
          {requests.length === 0 ? (
            <div className="p-4 text-center text-text-secondary">
              <div className="mb-2">📭</div>
              <div className="text-sm">No requests yet</div>
              <div className="text-xs mt-1">
                {webhookSettings.isRunning 
                  ? 'Send POST, GET, etc. requests to your webhook URL'
                  : 'Start the webhook to see requests'
                }
              </div>
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                onClick={() => onSelectRequest(request)}
                className={`p-3 border-b border-border cursor-pointer transition-colors hover:bg-dark-bg ${
                  selectedRequest?.id === request.id ? 'bg-dark-bg border-l-2 border-l-accent' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${getMethodColor(request.method)}`}>
                    {request.method}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {formatTimestamp(request.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-text-primary truncate mb-1">
                  {request.url}
                </div>
                {request.body && (
                  <div className="text-xs text-text-secondary truncate">
                    Body: {request.body.substring(0, 50)}...
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}; 