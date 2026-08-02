import os
import mlflow
from tealtiger.integrations.mlflow import MLflowGovernanceLogger

# Example using a mock TealOpenAI since we are focusing on MLflow
class MockTealOpenAI:
    def __init__(self, api_key, guardrails, on_decision):
        self.on_decision = on_decision
        self.guardrails = guardrails
        
    def run_agent_step(self, prompt: str):
        # Simulate an allowed tool call
        self.on_decision({
            "action": "ALLOW",
            "risk_score": 0.1,
            "latency_ms": 45,
            "reason": "Safe"
        })
        
        # Simulate a denied tool call due to PII
        if "secret" in prompt.lower():
            self.on_decision({
                "action": "DENY",
                "risk_score": 0.95,
                "latency_ms": 60,
                "reason": "PII Detected in arguments",
                "pii_detected": True
            })

def main():
    print("--- Running MLflow Governed Agent ---")
    
    # Set up MLflow tracking (local by default)
    mlflow.set_experiment("TealTiger_Governance_Demo")
    
    logger = MLflowGovernanceLogger(mode="enforce")
    
    with mlflow.start_run():
        print("MLflow run started.")
        client = MockTealOpenAI(
            api_key=os.environ.get("OPENAI_API_KEY", "dummy"),
            guardrails={"pii_detection": True},
            on_decision=logger.log,  # Each decision → MLflow artifact
        )
        
        # Run agent workflow
        print("Running agent...")
        client.run_agent_step("Analyze public data")
        client.run_agent_step("Query user secret_id=123")
        
        # Export summary as SARIF artifact
        logger.finalize()
        print("MLflow run finalized. Check mlflow ui for artifacts and metrics.")

if __name__ == "__main__":
    main()
