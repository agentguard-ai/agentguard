package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/tealtiger/tealtiger-sidecar/config"
	"github.com/tealtiger/tealtiger-sidecar/governance"
)

var engine *governance.Engine

func main() {
	configPath := flag.String("config", "config.yaml", "path to configuration file")
	flag.Parse()

	// Allow config path override via environment variable
	if envPath := os.Getenv("TEALTIGER_CONFIG"); envPath != "" {
		*configPath = envPath
	}

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Printf("WARN: failed to load config from %s: %v — using defaults", *configPath, err)
		cfg = config.DefaultConfig()
	}

	// Initialize governance engine
	engine = governance.NewEngine(cfg)

	// Set up routes
	mux := http.NewServeMux()
	mux.HandleFunc("/evaluate", handleEvaluate)
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/admin/freeze", handleFreeze)
	mux.HandleFunc("/admin/unfreeze", handleUnfreeze)

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeout) * time.Millisecond,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeout) * time.Millisecond,
	}

	log.Printf("TealTiger sidecar starting on %s", addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// handleEvaluate processes POST /evaluate requests per the Future AGI webhook contract.
func handleEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req governance.EvaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	resp := engine.Evaluate(req)

	w.Header().Set("Content-Type", "application/json")
	if !resp.Pass {
		w.WriteHeader(http.StatusOK) // Future AGI contract: always 200, pass/fail in body
	}
	json.NewEncoder(w).Encode(resp)
}

// handleHealth returns a simple health check response.
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	status := "healthy"
	if engine.IsFrozen() {
		status = "frozen"
	}
	fmt.Fprintf(w, `{"status":"%s","frozen":%t}`, status, engine.IsFrozen())
}

// handleFreeze activates the kill switch.
func handleFreeze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	engine.Freeze()
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"status":"frozen"}`)
}

// handleUnfreeze deactivates the kill switch.
func handleUnfreeze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	engine.Unfreeze()
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"status":"active"}`)
}
