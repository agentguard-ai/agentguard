import json
import os
import time
import mlflow
from typing import Dict, Any, List

class MLflowGovernanceLogger:
    """
    MLflow logger for TealTiger governance decisions.
    Logs metrics (risk_score, latency) per decision, and exports
    a SARIF/JSON artifact with the full audit trail when finalized.
    """
    def __init__(self, mode: str = "enforce"):
        self.mode = mode
        self.decisions = []
        self.total_denials = 0
        self.max_risk_score = 0.0
        
        # Log initial tags
        if mlflow.active_run():
            mlflow.set_tag("governance_mode", self.mode)

    def log(self, decision: Dict[str, Any]) -> None:
        """
        Callback to log an individual decision from TealTigerGuard.
        """
        # Store for artifact export
        decision_record = {
            "timestamp": time.time(),
            "decision": decision
        }
        self.decisions.append(decision_record)
        
        # Calculate metrics
        action = decision.get("action", "ALLOW")
        if action == "DENY":
            self.total_denials += 1
            
        risk_score = float(decision.get("risk_score", 0.0))
        if risk_score > self.max_risk_score:
            self.max_risk_score = risk_score
            
        latency = float(decision.get("latency_ms", 0.0))
        
        step = len(self.decisions)
        
        if mlflow.active_run():
            # Log metrics
            mlflow.log_metric("governance_risk_score", risk_score, step=step)
            if latency > 0:
                mlflow.log_metric("governance_latency_ms", latency, step=step)

    def _generate_sarif(self) -> Dict[str, Any]:
        """
        Generates a basic SARIF format representation of the denied decisions.
        """
        results = []
        for d in self.decisions:
            dec = d["decision"]
            if dec.get("action") == "DENY":
                results.append({
                    "ruleId": dec.get("reason", "policy_violation"),
                    "level": "error",
                    "message": {
                        "text": f"Governance blocked action: {dec.get('reason')}"
                    }
                })
                
        return {
            "version": "2.1.0",
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": "TealTiger",
                            "informationUri": "https://tealtiger.ai",
                            "rules": []
                        }
                    },
                    "results": results
                }
            ]
        }

    def finalize(self) -> None:
        """
        Exports summary metrics and the SARIF artifact to MLflow.
        """
        if not mlflow.active_run():
            return
            
        mlflow.set_tag("total_denials", self.total_denials)
        mlflow.set_tag("max_risk_score", self.max_risk_score)
        
        # Save raw JSON audit log
        audit_file = "tealtiger_audit.json"
        with open(audit_file, "w") as f:
            json.dump(self.decisions, f, indent=2)
        mlflow.log_artifact(audit_file)
        os.remove(audit_file)
        
        # Save SARIF artifact
        sarif_file = "tealtiger_audit.sarif"
        with open(sarif_file, "w") as f:
            json.dump(self._generate_sarif(), f, indent=2)
        mlflow.log_artifact(sarif_file)
        os.remove(sarif_file)
