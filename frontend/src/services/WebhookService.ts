import { WebhookRequest } from '../App';
import { StartWebhook, StopWebhook, GetStatus, EnableTunnel, DisableTunnel } from '../../wailsjs/go/main/App';

export class WebhookService {
  private eventSource: EventSource | null = null;
  private requestCallback: ((request: WebhookRequest) => void) | null = null;

  onRequest(callback: (request: WebhookRequest) => void) {
    this.requestCallback = callback;
  }

  async start(port: number, enableTunnel: boolean = true): Promise<{ publicUrl: string }> {
    try {
      // Wails backend metodunu çağır
      const result = await StartWebhook(port, enableTunnel);
      
      // SSE bağlantısı kurup webhook isteklerini dinle
      this.eventSource = new EventSource(`http://localhost:${port}/api/webhook/events`);
      
      this.eventSource.onmessage = (event) => {
        try {
          const request: WebhookRequest = JSON.parse(event.data);
          if (this.requestCallback) {
            this.requestCallback(request);
          }
        } catch (error) {
          console.error('Event parse error:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
      };

      return { publicUrl: result.publicUrl };
    } catch (error) {
      console.error('Webhook start error:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      // SSE bağlantısını kapat
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      // Wails backend metodunu çağır
      await StopWebhook();
    } catch (error) {
      console.error('Webhook stop error:', error);
      throw error;
    }
  }

  async getStatus(): Promise<any> {
    try {
      return await GetStatus();
    } catch (error) {
      console.error('Status get error:', error);
      throw error;
    }
  }

  async enableTunnel(): Promise<{ publicUrl: string }> {
    try {
      const result = await EnableTunnel();
      return { publicUrl: result.publicUrl };
    } catch (error) {
      console.error('Tunnel enable error:', error);
      throw error;
    }
  }

  async disableTunnel(): Promise<{ publicUrl: string }> {
    try {
      const result = await DisableTunnel();
      return { publicUrl: result.publicUrl };
    } catch (error) {
      console.error('Tunnel disable error:', error);
      throw error;
    }
  }

  // Test amaçlı mock data
  generateMockRequest(): WebhookRequest {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const paths = ['/api/users', '/api/orders', '/webhook', '/api/products'];
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      method: methods[Math.floor(Math.random() * methods.length)],
      url: paths[Math.floor(Math.random() * paths.length)],
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': '*/*',
        'Host': 'localhost:8080',
      },
      body: JSON.stringify({
        message: 'Test webhook request',
        timestamp: new Date().toISOString(),
        data: { id: Math.floor(Math.random() * 1000) }
      }),
      queryParams: {
        source: 'test',
        version: '1.0'
      },
      timestamp: new Date(),
    };
  }
} 