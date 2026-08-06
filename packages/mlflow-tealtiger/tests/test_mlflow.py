import os
import json
import pytest
from unittest.mock import patch, MagicMock, mock_open
from tealtiger.integrations.mlflow import MLflowGovernanceLogger

@pytest.fixture
def mock_mlflow():
    with patch("tealtiger.integrations.mlflow.mlflow") as mock:
        yield mock

def test_logger_init(mock_mlflow):
    mock_mlflow.active_run.return_value = True
    logger = MLflowGovernanceLogger(mode="audit")
    assert logger.mode == "audit"
    mock_mlflow.set_tag.assert_called_with("governance_mode", "audit")

def test_logger_log_allow(mock_mlflow):
    mock_mlflow.active_run.return_value = True
    logger = MLflowGovernanceLogger()
    
    decision = {
        "action": "ALLOW",
        "risk_score": 0.2,
        "latency_ms": 150
    }
    logger.log(decision)
    
    assert len(logger.decisions) == 1
    assert logger.total_denials == 0
    assert logger.max_risk_score == 0.2
    
    mock_mlflow.log_metric.assert_any_call("governance_risk_score", 0.2, step=1)
    mock_mlflow.log_metric.assert_any_call("governance_latency_ms", 150.0, step=1)

def test_logger_log_deny(mock_mlflow):
    mock_mlflow.active_run.return_value = True
    logger = MLflowGovernanceLogger()
    
    decision = {
        "action": "DENY",
        "risk_score": 0.9,
        "latency_ms": 100,
        "reason": "PII detected"
    }
    logger.log(decision)
    
    assert logger.total_denials == 1
    assert logger.max_risk_score == 0.9

def test_generate_sarif(mock_mlflow):
    logger = MLflowGovernanceLogger()
    logger.decisions = [
        {"decision": {"action": "ALLOW", "risk_score": 0.1}},
        {"decision": {"action": "DENY", "reason": "PII Detected", "risk_score": 0.9}}
    ]
    
    sarif = logger._generate_sarif()
    assert sarif["version"] == "2.1.0"
    results = sarif["runs"][0]["results"]
    assert len(results) == 1
    assert results[0]["ruleId"] == "PII Detected"
    assert results[0]["level"] == "error"

@patch("tealtiger.integrations.mlflow.os.remove")
def test_finalize(mock_remove, mock_mlflow):
    mock_mlflow.active_run.return_value = True
    logger = MLflowGovernanceLogger()
    logger.total_denials = 1
    logger.max_risk_score = 0.9
    
    # We can mock builtins.open to avoid actually writing files
    with patch("builtins.open", mock_open()) as mocked_file:
        logger.finalize()
        
    mock_mlflow.set_tag.assert_any_call("total_denials", 1)
    mock_mlflow.set_tag.assert_any_call("max_risk_score", 0.9)
    
    mock_mlflow.log_artifact.assert_any_call("tealtiger_audit.json")
    mock_mlflow.log_artifact.assert_any_call("tealtiger_audit.sarif")
    
    assert mock_remove.call_count == 2
