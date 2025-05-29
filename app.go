package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// WebhookRequest represents an incoming webhook request
type WebhookRequest struct {
	ID          string            `json:"id"`
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	QueryParams map[string]string `json:"queryParams"`
	Timestamp   time.Time         `json:"timestamp"`
}

// WebhookResponse represents the response for starting webhook
type WebhookResponse struct {
	PublicURL string `json:"publicUrl"`
	Port      int    `json:"port"`
}

// App struct
type App struct {
	ctx         context.Context
	server      *http.Server
	router      *mux.Router
	isRunning   bool
	mu          sync.RWMutex
	clients     map[string]chan WebhookRequest
	clientsMu   sync.RWMutex
	publicURL   string
	currentPort int
	tunnelCmd   *exec.Cmd
}

// NewApp creates a new App application struct
func NewApp() *App {
	app := &App{
		clients: make(map[string]chan WebhookRequest),
	}
	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// StartWebhook starts the webhook server
func (a *App) StartWebhook(port int, enableTunnel bool) (*WebhookResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.isRunning {
		return nil, fmt.Errorf("webhook zaten çalışıyor")
	}

	// Router oluştur
	a.router = mux.NewRouter()
	a.setupRoutes()

	// Server oluştur
	a.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: a.router,
	}

	a.currentPort = port

	// Server'ı başlat ve hazır olmasını bekle
	serverReady := make(chan bool, 1)
	serverError := make(chan error, 1)

	go func() {
		log.Printf("Webhook server %d portunda başlatılıyor...", port)

		// Listen'i başlat
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err != nil {
			serverError <- fmt.Errorf("port %d dinlenemedi: %v", port, err)
			return
		}

		// Server hazır
		serverReady <- true

		// Server'ı başlat
		if err := a.server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("Server hatası: %v", err)
		}
	}()

	// Server'ın hazır olmasını bekle
	select {
	case <-serverReady:
		log.Printf("Server %d portunda hazır", port)
	case err := <-serverError:
		return nil, err
	case <-time.After(5 * time.Second):
		return nil, fmt.Errorf("server 5 saniye içinde başlatılamadı")
	}

	var publicURL string

	// Tunnel sadece istenirse oluştur
	if enableTunnel {
		log.Printf("Server hazır, tunnel oluşturuluyor...")

		tunnelURL, err := a.createTunnel(port)
		if err != nil {
			log.Printf("localhost.run tunnel başarısız: %v", err)
			// Tunnel başarısız olursa localhost URL kullan
			publicURL = fmt.Sprintf("http://localhost:%d", port)
			log.Printf("Tunnel başarısız, localhost URL kullanılıyor: %s", publicURL)
		} else {
			publicURL = tunnelURL
		}
	} else {
		// Tunnel istenmiyor, localhost URL kullan
		publicURL = fmt.Sprintf("http://localhost:%d", port)
		log.Printf("Tunnel devre dışı, localhost URL kullanılıyor: %s", publicURL)
	}

	a.publicURL = publicURL
	a.isRunning = true

	log.Printf("Webhook server başarıyla başlatıldı: %s", publicURL)

	return &WebhookResponse{
		PublicURL: publicURL,
		Port:      port,
	}, nil
}

// createTunnel creates a real localhost.run tunnel
func (a *App) createTunnel(port int) (string, error) {
	log.Printf("localhost.run tunnel oluşturuluyor, port: %d", port)

	// Test: localhost'ta server çalışıyor mu?
	testURL := fmt.Sprintf("http://localhost:%d", port)
	resp, err := http.Get(testURL)
	if err != nil {
		return "", fmt.Errorf("local server %s erişilebilir değil: %v", testURL, err)
	}
	resp.Body.Close()
	log.Printf("Local server %s erişilebilir ✓", testURL)

	// SSH komutu ile localhost.run tunnel'ı oluştur
	// Port mapping: remote 80 -> local port
	cmd := exec.Command("ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-R", fmt.Sprintf("80:127.0.0.1:%d", port),
		"localhost.run")

	// Hem stdout hem stderr'ı yakala
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("stdout pipe hatası: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", fmt.Errorf("stderr pipe hatası: %v", err)
	}

	// Komutu başlat
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("SSH komutu başlatılamadı: %v", err)
	}

	a.tunnelCmd = cmd

	// URL'yi yakalamak için goroutine
	urlChan := make(chan string, 1)
	errorChan := make(chan error, 1)

	// stdout okuma
	go func() {
		buf := make([]byte, 4096)
		fullOutput := ""
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				if err.Error() != "EOF" {
					log.Printf("stdout okuma hatası: %v", err)
				}
				break
			}
			output := string(buf[:n])
			fullOutput += output

			// localhost.run'ın gerçek formatını ara
			// "99d05824229039.lhr.life tunneled with tls termination, https://99d05824229039.lhr.life"
			lines := strings.Split(fullOutput, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)

				// "tunneled with tls termination" içeren satırı ara
				if strings.Contains(line, "tunneled with tls termination") {
					// Bu satırdan URL'yi çıkar
					patterns := []string{
						`https://[a-zA-Z0-9\-]+\.lhr\.life`,
						`http://[a-zA-Z0-9\-]+\.lhr\.life`,
					}

					for _, pattern := range patterns {
						re := regexp.MustCompile(pattern)
						if matches := re.FindStringSubmatch(line); len(matches) > 0 {
							log.Printf("Tunnel URL bulundu: %s", matches[0])
							urlChan <- matches[0]
							return
						}
					}
				}

				// Alternatif: basit URL formatı da ara
				patterns := []string{
					`https://[a-zA-Z0-9\-]+\.lhr\.life`,
					`http://[a-zA-Z0-9\-]+\.lhr\.life`,
					`https://[a-zA-Z0-9\-]+\.localhost\.run`,
					`http://[a-zA-Z0-9\-]+\.localhost\.run`,
				}

				for _, pattern := range patterns {
					re := regexp.MustCompile(pattern)
					if matches := re.FindStringSubmatch(line); len(matches) > 0 {
						log.Printf("Tunnel URL bulundu: %s", matches[0])
						urlChan <- matches[0]
						return
					}
				}
			}
		}
	}()

	// stderr okuma
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stderr.Read(buf)
			if err != nil {
				break
			}
			output := string(buf[:n])
			log.Printf("SSH stderr: %s", output)

			// Hata kontrolü
			if strings.Contains(output, "Connection refused") ||
				strings.Contains(output, "Permission denied") ||
				strings.Contains(output, "Host key verification failed") {
				errorChan <- fmt.Errorf("SSH bağlantı hatası: %s", output)
				return
			}

			// Başarılı bağlantı mesajları da kontrol et
			if strings.Contains(output, "tunneled with tls termination") ||
				strings.Contains(output, ".lhr.life") {
				// stderr'da da URL olabilir
				patterns := []string{
					`https://[a-zA-Z0-9\-]+\.lhr\.life`,
					`http://[a-zA-Z0-9\-]+\.lhr\.life`,
				}

				for _, pattern := range patterns {
					re := regexp.MustCompile(pattern)
					if matches := re.FindStringSubmatch(output); len(matches) > 0 {
						log.Printf("Tunnel URL stderr'da bulundu: %s", matches[0])
						urlChan <- matches[0]
						return
					}
				}
			}
		}
	}()

	// 20 saniye bekle URL için
	select {
	case url := <-urlChan:
		// URL'yi test et
		go func() {
			time.Sleep(2 * time.Second) // Tunnel'ın stabilize olması için bekle
			if resp, err := http.Get(url); err == nil {
				resp.Body.Close()
				log.Printf("Tunnel URL test edildi ve erişilebilir: %s ✓", url)
			} else {
				log.Printf("Tunnel URL test hatası: %v", err)
			}
		}()
		return url, nil
	case err := <-errorChan:
		if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
			a.tunnelCmd.Process.Kill()
		}
		return "", err
	case <-time.After(20 * time.Second):
		// Tunnel oluşturulamadı, komutu durdur
		if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
			a.tunnelCmd.Process.Kill()
		}
		return "", fmt.Errorf("tunnel URL'si 20 saniye içinde alınamadı")
	}
}

// StopWebhook stops the webhook server
func (a *App) StopWebhook() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.isRunning {
		return fmt.Errorf("webhook çalışmıyor")
	}

	// Önce tüm SSE bağlantılarını kapat
	a.clientsMu.Lock()
	for clientID, ch := range a.clients {
		close(ch)
		delete(a.clients, clientID)
	}
	a.clientsMu.Unlock()

	// Tunnel'ı durdur
	if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
		log.Println("SSH tunnel kapatılıyor...")
		a.tunnelCmd.Process.Kill()
		a.tunnelCmd.Wait()
		a.tunnelCmd = nil
	}

	// Server'ı kapat
	if a.server != nil {
		// Timeout süresini 15 saniyeye çıkar
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		log.Println("HTTP server kapatılıyor...")
		if err := a.server.Shutdown(ctx); err != nil {
			// Graceful shutdown başarısız olursa force close dene
			log.Printf("Graceful shutdown başarısız: %v, force close deneniyor...", err)
			if closeErr := a.server.Close(); closeErr != nil {
				log.Printf("Force close da başarısız: %v", closeErr)
				// Yine de devam et, state'i temizle
			}
		}
	}

	a.isRunning = false
	a.publicURL = ""
	a.server = nil
	a.router = nil

	log.Println("Webhook server durduruldu")
	return nil
}

// GetStatus returns the current webhook status
func (a *App) GetStatus() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return map[string]interface{}{
		"isRunning": a.isRunning,
		"publicUrl": a.publicURL,
		"port":      a.currentPort,
	}
}

// setupRoutes sets up the webhook routes
func (a *App) setupRoutes() {
	// API routes
	api := a.router.PathPrefix("/api").Subrouter()

	// Webhook start/stop endpoints
	api.HandleFunc("/webhook/start", a.handleStartWebhook).Methods("POST")
	api.HandleFunc("/webhook/stop", a.handleStopWebhook).Methods("POST")
	api.HandleFunc("/webhook/events", a.handleSSE).Methods("GET")

	// Catch-all webhook handler
	a.router.PathPrefix("/").HandlerFunc(a.handleWebhook)
}

// handleStartWebhook handles webhook start requests
func (a *App) handleStartWebhook(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Port         int  `json:"port"`
		EnableTunnel bool `json:"enableTunnel"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	response, err := a.StartWebhook(req.Port, req.EnableTunnel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleStopWebhook handles webhook stop requests
func (a *App) handleStopWebhook(w http.ResponseWriter, r *http.Request) {
	if err := a.StopWebhook(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

// handleSSE handles Server-Sent Events for real-time webhook notifications
func (a *App) handleSSE(w http.ResponseWriter, r *http.Request) {
	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Create channel for this client
	clientID := uuid.New().String()
	clientChan := make(chan WebhookRequest, 100)

	a.clientsMu.Lock()
	a.clients[clientID] = clientChan
	a.clientsMu.Unlock()

	// Remove client when connection closes
	defer func() {
		a.clientsMu.Lock()
		if ch, exists := a.clients[clientID]; exists {
			close(ch)
			delete(a.clients, clientID)
		}
		a.clientsMu.Unlock()
	}()

	// Send events to client
	for {
		select {
		case request, ok := <-clientChan:
			if !ok {
				return
			}

			data, _ := json.Marshal(request)
			fmt.Fprintf(w, "data: %s\n\n", data)

			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}

		case <-r.Context().Done():
			return
		}
	}
}

// handleWebhook handles all incoming webhook requests
func (a *App) handleWebhook(w http.ResponseWriter, r *http.Request) {
	// Skip API routes
	if strings.HasPrefix(r.URL.Path, "/api/") {
		return
	}

	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Body okuma hatası: %v", err)
		body = []byte{}
	}

	// Extract headers
	headers := make(map[string]string)
	for key, values := range r.Header {
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}

	// Extract query parameters
	queryParams := make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			queryParams[key] = values[0]
		}
	}

	// Create webhook request
	webhookReq := WebhookRequest{
		ID:          uuid.New().String(),
		Method:      r.Method,
		URL:         r.URL.Path,
		Headers:     headers,
		Body:        string(body),
		QueryParams: queryParams,
		Timestamp:   time.Now(),
	}

	// Broadcast to all connected clients
	a.clientsMu.RLock()
	for _, clientChan := range a.clients {
		select {
		case clientChan <- webhookReq:
		default:
			// Channel is full, skip this client
		}
	}
	a.clientsMu.RUnlock()

	log.Printf("Webhook alındı: %s %s", r.Method, r.URL.Path)

	// Send response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "received",
		"id":      webhookReq.ID,
		"message": "Webhook başarıyla alındı",
	})
}

// Greet returns a greeting for the given name (keeping for compatibility)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// EnableTunnel enables tunnel for running webhook
func (a *App) EnableTunnel() (*WebhookResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.isRunning {
		return nil, fmt.Errorf("webhook çalışmıyor")
	}

	// Zaten tunnel varsa bir şey yapma
	if strings.Contains(a.publicURL, "lhr.life") {
		return &WebhookResponse{
			PublicURL: a.publicURL,
			Port:      a.currentPort,
		}, nil
	}

	log.Printf("Runtime'da tunnel oluşturuluyor...")

	tunnelURL, err := a.createTunnel(a.currentPort)
	if err != nil {
		log.Printf("Runtime tunnel başarısız: %v", err)
		return nil, fmt.Errorf("tunnel oluşturulamadı: %v", err)
	}

	a.publicURL = tunnelURL
	log.Printf("Runtime tunnel başarıyla oluşturuldu: %s", tunnelURL)

	return &WebhookResponse{
		PublicURL: a.publicURL,
		Port:      a.currentPort,
	}, nil
}

// DisableTunnel disables tunnel for running webhook
func (a *App) DisableTunnel() (*WebhookResponse, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if !a.isRunning {
		return nil, fmt.Errorf("webhook çalışmıyor")
	}

	// Tunnel'ı kapat
	if a.tunnelCmd != nil && a.tunnelCmd.Process != nil {
		log.Println("Runtime tunnel kapatılıyor...")
		a.tunnelCmd.Process.Kill()
		a.tunnelCmd.Wait()
		a.tunnelCmd = nil
	}

	// Localhost URL'ye geç
	a.publicURL = fmt.Sprintf("http://localhost:%d", a.currentPort)
	log.Printf("Tunnel kapatıldı, localhost URL kullanılıyor: %s", a.publicURL)

	return &WebhookResponse{
		PublicURL: a.publicURL,
		Port:      a.currentPort,
	}, nil
}
