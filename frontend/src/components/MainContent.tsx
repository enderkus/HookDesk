import React, { useState } from 'react';
import { WebhookRequest, WebhookSettings } from '../App';

interface MainContentProps {
  selectedRequest: WebhookRequest | null;
  webhookSettings: WebhookSettings;
}

export const MainContent: React.FC<MainContentProps> = ({
  selectedRequest,
  webhookSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'headers' | 'body' | 'query'>('headers');

  const formatJson = (str: string) => {
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!selectedRequest) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-bg">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-sidebar-bg rounded-lg flex items-center justify-center">
            <svg
              className="w-8 h-8 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Welcome to HookDesk
          </h2>
          <p className="text-text-secondary mb-6 max-w-md">
            {webhookSettings.isRunning
              ? 'Webhook is running. Select from the left panel to view incoming requests.'
              : 'Click the "Start" button on the left to begin webhook testing.'}
          </p>
          {webhookSettings.publicUrl && (
            <div className="bg-sidebar-bg rounded-lg p-4 max-w-md">
              <p className="text-sm text-text-secondary mb-2">Public URL:</p>
              <div className="flex items-center">
                <code className="text-accent bg-dark-bg px-2 py-1 rounded text-sm flex-1 mr-2">
                  {webhookSettings.publicUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(webhookSettings.publicUrl)}
                  className="px-2 py-1 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-bg overflow-hidden">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-medium mr-3 ${
                selectedRequest.method === 'GET'
                  ? 'bg-green-900 text-green-200'
                  : selectedRequest.method === 'POST'
                  ? 'bg-blue-900 text-blue-200'
                  : selectedRequest.method === 'PUT'
                  ? 'bg-yellow-900 text-yellow-200'
                  : selectedRequest.method === 'DELETE'
                  ? 'bg-red-900 text-red-200'
                  : 'bg-gray-900 text-gray-200'
              }`}
            >
              {selectedRequest.method}
            </span>
            <h2 className="text-lg font-medium text-text-primary">
              {selectedRequest.url}
            </h2>
          </div>
          <span className="text-sm text-text-secondary">
            {new Date(selectedRequest.timestamp).toLocaleString('en-US')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-sidebar-bg border-b border-border">
        <div className="flex p-4 gap-4">
          {[
            { key: 'headers', label: 'Headers' },
            { key: 'body', label: 'Body' },
            { key: 'query', label: 'Query Params' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 text-sm font-medium transition-all duration-200 relative ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              } rounded-t-md`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'headers' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {Object.keys(selectedRequest.headers).length === 0 ? (
                <p className="text-text-secondary">No headers found</p>
              ) : (
                Object.entries(selectedRequest.headers).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start bg-sidebar-bg rounded p-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary mb-1">
                        {key}
                      </div>
                      <div className="text-sm text-text-secondary break-all">
                        {value}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(value)}
                      className="ml-2 p-1 text-text-secondary hover:text-text-primary transition-colors"
                      title="Copy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <h3 className="text-sm font-medium text-text-secondary">Request Body</h3>
              {selectedRequest.body && (
                <button
                  onClick={() => copyToClipboard(selectedRequest.body)}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors flex-shrink-0"
                >
                  Copy
                </button>
              )}
            </div>
            <div 
              className="p-4"
              style={{ 
                height: 'calc(100vh - 250px)',
                overflow: 'auto'
              }}
            >
              {selectedRequest.body ? (
                <pre className="text-sm text-text-primary bg-sidebar-bg p-4 rounded whitespace-pre-wrap break-words">
                  {formatJson(selectedRequest.body)}
                </pre>
              ) : (
                <p className="text-text-secondary">No body found</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'query' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {Object.keys(selectedRequest.queryParams).length === 0 ? (
                <p className="text-text-secondary">No query parameters found</p>
              ) : (
                Object.entries(selectedRequest.queryParams).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start bg-sidebar-bg rounded p-3"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary mb-1">
                        {key}
                      </div>
                      <div className="text-sm text-text-secondary break-all">
                        {value}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(value)}
                      className="ml-2 p-1 text-text-secondary hover:text-text-primary transition-colors"
                      title="Copy"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 