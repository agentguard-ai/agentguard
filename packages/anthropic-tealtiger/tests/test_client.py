import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from anthropic_tealtiger.client import TealAnthropic, AsyncTealAnthropic, GovernanceDenyError

@pytest.fixture
def mock_anthropic():
    with patch("anthropic_tealtiger.client.Anthropic") as MockClass:
        yield MockClass

@pytest.fixture
def mock_async_anthropic():
    with patch("anthropic_tealtiger.client.AsyncAnthropic") as MockClass:
        yield MockClass

def test_pii_detection():
    # Setup mock response with a tool call containing PII
    client = TealAnthropic(api_key="test", guardrails={"pii_detection": True})
    
    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.type = "tool_use"
    mock_block.name = "process_user"
    mock_block.input = {"ssn": "123-45-678"}
    mock_response.content = [mock_block]
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 10

    # We patch the underlying super().messages.create to return the mock response
    client.messages._messages = MagicMock()
    client.messages._messages.create.return_value = mock_response

    with pytest.raises(GovernanceDenyError, match="PII detected"):
        client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])

def test_secret_detection():
    client = TealAnthropic(api_key="test", guardrails={"secret_detection": True})
    
    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.type = "tool_use"
    mock_block.name = "db_login"
    mock_block.input = {"api_key": "sk-123456789"}
    mock_response.content = [mock_block]
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 10

    client.messages._messages = MagicMock()
    client.messages._messages.create.return_value = mock_response

    with pytest.raises(GovernanceDenyError, match="Secret detected"):
        client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])

def test_budget_exceeded():
    client = TealAnthropic(api_key="test", budget={"max_cost_per_session": 0.0005})
    
    mock_response = MagicMock()
    mock_response.content = []
    # 100k input tokens = $1.0 (exceeds 0.0005)
    mock_response.usage.input_tokens = 100000
    mock_response.usage.output_tokens = 0

    client.messages._messages = MagicMock()
    client.messages._messages.create.return_value = mock_response

    with pytest.raises(GovernanceDenyError, match="Budget exceeded after call"):
        client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])

    # Second call should fail before calling API
    with pytest.raises(GovernanceDenyError, match="Budget exceeded before call"):
        client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])

@pytest.mark.asyncio
async def test_async_pii_detection():
    client = AsyncTealAnthropic(api_key="test", guardrails={"pii_detection": True})
    
    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.type = "tool_use"
    mock_block.name = "process_user"
    mock_block.input = {"ssn": "123-45-678"}
    mock_response.content = [mock_block]
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 10

    client.messages._messages = AsyncMock()
    client.messages._messages.create.return_value = mock_response

    with pytest.raises(GovernanceDenyError, match="PII detected"):
        await client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])

@pytest.mark.asyncio
async def test_async_budget_exceeded():
    client = AsyncTealAnthropic(api_key="test", budget={"max_cost_per_session": 0.0005})
    
    mock_response = MagicMock()
    mock_response.content = []
    mock_response.usage.input_tokens = 100000
    mock_response.usage.output_tokens = 0

    client.messages._messages = AsyncMock()
    client.messages._messages.create.return_value = mock_response

    with pytest.raises(GovernanceDenyError, match="Budget exceeded after call"):
        await client.messages.create(model="claude-3-opus", messages=[{"role": "user", "content": "test"}])
