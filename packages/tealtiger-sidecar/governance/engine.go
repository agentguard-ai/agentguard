package governance

import (
	"crypto/rand"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/tealtiger/tealtiger-sidecar/config"
)

// Engine evaluates requests against configured governance policies.
type Engine struct {
	cfg      *config.Config
	mu       sync.RWMutex
	frozen   bool
	sessions map[string]float64 // agent_id -> cumulative cost
}

// NewEngine creates a governance engine from the given config.
func NewEngine(cfg *config.Config) *Engine {
	return &Engine{
		cfg:      cfg,
		sessions: make(map[string]float64),
	}
}

// Freeze activates the kill switch — all evaluations will fail.
func (e *Engine) Freeze() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.frozen = true
}

// Unfreeze deactivates the kill switch.
func (e *Engine) Unfreeze() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.frozen = false
}

// IsFrozen returns the current kill switch state.
func (e *Engine) IsFrozen() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.frozen
}

// Evaluate runs all configured policies against the request.
func (e *Engine) Evaluate(req EvaluateRequest) EvaluateResponse {
	start := time.Now()
	reasons := []string{}
	pass := true
	score := 1.0

	// 1. Kill switch check
	if e.IsFrozen() {
		return EvaluateResponse{
			Pass:    false,
			Score:   0.0,
			Message: "agent frozen by kill switch",
			Details: ResponseDetails{
				DecisionID:       generateUUID(),
				ReasonCodes:      []string{"kill_switch_active"},
				EvaluationTimeMs: msElapsed(start),
			},
		}
	}

	// 2. Tool allowlist/denylist (glob matching)
	if e.cfg.Policies.ToolControl.Enabled {
		toolBlocked, toolReason := e.evaluateToolControl(req.Metadata.ToolName)
		if toolBlocked {
			pass = false
			score = 0.0
			reasons = append(reasons, toolReason)
		}
	}

	// 3. PII detection
	if e.cfg.Policies.PIIDetection.Enabled {
		piiFound := e.evaluatePII(req.Text)
		if len(piiFound) > 0 {
			pass = false
			score = minFloat(score, 0.2)
			reasons = append(reasons, piiFound...)
		}
	}

	// 4. Secret detection
	if e.cfg.Policies.SecretDetection.Enabled {
		secretsFound := e.evaluateSecrets(req.Text)
		if len(secretsFound) > 0 {
			pass = false
			score = minFloat(score, 0.1)
			reasons = append(reasons, secretsFound...)
		}
	}

	// 5. Cost budget tracking
	if e.cfg.Policies.CostBudget.Enabled {
		overBudget, costReason := e.evaluateCostBudget(req.Metadata.AgentID)
		if overBudget {
			pass = false
			score = minFloat(score, 0.3)
			reasons = append(reasons, costReason)
		}
	}

	message := "all policies passed"
	if !pass {
		message = "blocked: " + strings.Join(reasons, "; ")
	}

	return EvaluateResponse{
		Pass:    pass,
		Score:   score,
		Message: message,
		Details: ResponseDetails{
			DecisionID:       generateUUID(),
			ReasonCodes:      reasons,
			EvaluationTimeMs: msElapsed(start),
		},
	}
}

// evaluateToolControl checks tool against allowlist/denylist using glob matching.
func (e *Engine) evaluateToolControl(toolName string) (blocked bool, reason string) {
	if toolName == "" {
		return false, ""
	}

	tc := e.cfg.Policies.ToolControl

	// Check denylist first (deny takes precedence)
	for _, pattern := range tc.Denylist {
		if matched, _ := filepath.Match(pattern, toolName); matched {
			return true, "tool_denied:" + toolName
		}
	}

	// If allowlist is defined, tool must match at least one pattern
	if len(tc.Allowlist) > 0 {
		allowed := false
		for _, pattern := range tc.Allowlist {
			if matched, _ := filepath.Match(pattern, toolName); matched {
				allowed = true
				break
			}
		}
		if !allowed {
			return true, "tool_not_allowed:" + toolName
		}
	}

	return false, ""
}

// evaluatePII checks text for PII patterns.
func (e *Engine) evaluatePII(text string) []string {
	var found []string
	patterns := PIIPatterns()

	// Filter to only enabled patterns if specified
	enabledSet := makeSet(e.cfg.Policies.PIIDetection.Patterns)

	for name, re := range patterns {
		if len(enabledSet) > 0 && !enabledSet[name] {
			continue
		}
		if re.MatchString(text) {
			found = append(found, "pii_detected:"+name)
		}
	}
	return found
}

// evaluateSecrets checks text for secret patterns.
func (e *Engine) evaluateSecrets(text string) []string {
	var found []string
	patterns := SecretPatterns()

	enabledSet := makeSet(e.cfg.Policies.SecretDetection.Patterns)

	for name, re := range patterns {
		if len(enabledSet) > 0 && !enabledSet[name] {
			continue
		}
		if re.MatchString(text) {
			found = append(found, "secret_detected:"+name)
		}
	}
	return found
}

// evaluateCostBudget checks if the session has exceeded its budget.
func (e *Engine) evaluateCostBudget(agentID string) (overBudget bool, reason string) {
	if agentID == "" {
		return false, ""
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	budget := e.cfg.Policies.CostBudget.MaxPerSession
	current := e.sessions[agentID]

	// Increment by per-request cost
	cost := e.cfg.Policies.CostBudget.PerRequestCost
	if cost <= 0 {
		cost = 0.01 // default per-request cost
	}
	current += cost
	e.sessions[agentID] = current

	if current > budget {
		return true, "cost_budget_exceeded"
	}
	return false, ""
}

// ResetSession resets cost tracking for a session.
func (e *Engine) ResetSession(sessionID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.sessions, sessionID)
}

// --- Helpers ---

// generateUUID produces a UUID v4 using crypto/rand (no external deps).
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func msElapsed(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1000.0
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func makeSet(items []string) map[string]bool {
	if len(items) == 0 {
		return nil
	}
	s := make(map[string]bool, len(items))
	for _, item := range items {
		s[item] = true
	}
	return s
}

// init validates that all regex patterns compiled successfully at startup.
func init() {
	for name, re := range PIIPatterns() {
		if re == nil {
			panic("nil PII pattern: " + name)
		}
	}
	for name, re := range SecretPatterns() {
		if re == nil {
			panic("nil secret pattern: " + name)
		}
	}
}
