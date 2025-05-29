import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { StatusBar } from './components/StatusBar';
import { WebhookService } from './services/WebhookService';

export interface WebhookRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  timestamp: Date;
  queryParams: Record<string, string>;
}

export interface WebhookSettings {
  port: number;
  isRunning: boolean;
  publicUrl: string;
}

function App() {
  const [requests, setRequests] = useState<WebhookRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<WebhookRequest | null>(null);
  const [tunnelEnabled, setTunnelEnabled] = useState<boolean>(true);
  const [webhookSettings, setWebhookSettings] = useState<WebhookSettings>({
    port: 8080,
    isRunning: false,
    publicUrl: ''
  });

  const webhookService = new WebhookService();

  useEffect(() => {
    // Webhook servisini başlat
    webhookService.onRequest((request: WebhookRequest) => {
      setRequests(prev => [request, ...prev]);
    });
  }, []);

  const startWebhook = async () => {
    try {
      const result = await webhookService.start(webhookSettings.port, tunnelEnabled);
      setWebhookSettings(prev => ({
        ...prev,
        isRunning: true,
        publicUrl: result.publicUrl
      }));
    } catch (error) {
      console.error('Webhook başlatılamadı:', error);
    }
  };

  const stopWebhook = async () => {
    try {
      await webhookService.stop();
      setWebhookSettings(prev => ({
        ...prev,
        isRunning: false,
        publicUrl: ''
      }));
    } catch (error) {
      console.error('Webhook durdurulamadı:', error);
    }
  };

  const clearRequests = () => {
    setRequests([]);
    setSelectedRequest(null);
  };

  const handleTunnelToggle = async (enabled: boolean) => {
    setTunnelEnabled(enabled);
    
    // Eğer webhook çalışıyorsa runtime'da tunnel'ı aç/kapat
    if (webhookSettings.isRunning) {
      try {
        if (enabled) {
          const result = await webhookService.enableTunnel();
          setWebhookSettings(prev => ({
            ...prev,
            publicUrl: result.publicUrl
          }));
        } else {
          const result = await webhookService.disableTunnel();
          setWebhookSettings(prev => ({
            ...prev,
            publicUrl: result.publicUrl
          }));
        }
      } catch (error) {
        console.error('Tunnel toggle hatası:', error);
        // Hata durumunda checkbox'ı eski haline döndür
        setTunnelEnabled(!enabled);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-dark-bg text-text-primary">
      <div className="flex flex-1">
        <Sidebar
          requests={requests}
          selectedRequest={selectedRequest}
          onSelectRequest={setSelectedRequest}
          webhookSettings={webhookSettings}
          onStartWebhook={startWebhook}
          onStopWebhook={stopWebhook}
          onClearRequests={clearRequests}
          onPortChange={(port: number) => setWebhookSettings(prev => ({ ...prev, port }))}
          onTunnelToggle={handleTunnelToggle}
          tunnelEnabled={tunnelEnabled}
        />
        <MainContent
          selectedRequest={selectedRequest}
          webhookSettings={webhookSettings}
        />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
