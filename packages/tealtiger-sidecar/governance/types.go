package governance

// EvaluateRequest matches the Future AGI webhook contract input.
type EvaluateRequest struct {
	Text     string   `json:"text"`
	Metadata Metadata `json:"metadata"`
}

// Metadata carries agent and tool context.
type Metadata struct {
	AgentID  string `json:"agent_id"`
	ToolName string `json:"tool_name"`
}

// EvaluateResponse matches the Future AGI webhook contract output.
type EvaluateResponse struct {
	Pass    bool            `json:"pass"`
	Score   float64         `json:"score"`
	Message string          `json:"message"`
	Details ResponseDetails `json:"details"`
}

// ResponseDetails provides structured evaluation metadata.
type ResponseDetails struct {
	DecisionID      string   `json:"decision_id"`
	ReasonCodes     []string `json:"reason_codes"`
	EvaluationTimeMs float64 `json:"evaluation_time_ms"`
}
