package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config represents the sidecar's governance configuration.
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Policies PoliciesConfig `yaml:"policies"`
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	Port         int    `yaml:"port"`
	ReadTimeout  int    `yaml:"read_timeout_ms"`
	WriteTimeout int    `yaml:"write_timeout_ms"`
}

// PoliciesConfig groups all policy configurations.
type PoliciesConfig struct {
	ToolControl     ToolControlConfig     `yaml:"tool_control"`
	PIIDetection    PIIDetectionConfig    `yaml:"pii_detection"`
	SecretDetection SecretDetectionConfig `yaml:"secret_detection"`
	CostBudget      CostBudgetConfig      `yaml:"cost_budget"`
	KillSwitch      KillSwitchConfig      `yaml:"kill_switch"`
}

// ToolControlConfig defines tool allowlist/denylist policy.
type ToolControlConfig struct {
	Enabled   bool     `yaml:"enabled"`
	Allowlist []string `yaml:"allowlist"`
	Denylist  []string `yaml:"denylist"`
}

// PIIDetectionConfig defines PII scanning policy.
type PIIDetectionConfig struct {
	Enabled  bool     `yaml:"enabled"`
	Patterns []string `yaml:"patterns"` // empty = all patterns enabled
}

// SecretDetectionConfig defines secret scanning policy.
type SecretDetectionConfig struct {
	Enabled  bool     `yaml:"enabled"`
	Patterns []string `yaml:"patterns"` // empty = all patterns enabled
}

// CostBudgetConfig defines per-session cost tracking.
type CostBudgetConfig struct {
	Enabled        bool    `yaml:"enabled"`
	MaxPerSession  float64 `yaml:"max_per_session"`
	PerRequestCost float64 `yaml:"per_request_cost"`
}

// KillSwitchConfig defines the agent kill switch.
type KillSwitchConfig struct {
	Enabled bool `yaml:"enabled"`
}

// Load reads and parses a YAML config file.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	cfg := &Config{
		Server: ServerConfig{
			Port:         8080,
			ReadTimeout:  5000,
			WriteTimeout: 5000,
		},
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parsing config YAML: %w", err)
	}

	return cfg, nil
}

// DefaultConfig returns a config with sensible defaults.
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         8080,
			ReadTimeout:  5000,
			WriteTimeout: 5000,
		},
		Policies: PoliciesConfig{
			ToolControl:     ToolControlConfig{Enabled: true},
			PIIDetection:    PIIDetectionConfig{Enabled: true},
			SecretDetection: SecretDetectionConfig{Enabled: true},
			CostBudget: CostBudgetConfig{
				Enabled:        true,
				MaxPerSession:  5.0,
				PerRequestCost: 0.01,
			},
			KillSwitch: KillSwitchConfig{Enabled: true},
		},
	}
}
