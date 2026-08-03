import json
from pathlib import Path


FIXTURES = Path(__file__).parents[1] / "examples" / "kyc-agent" / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_customer_fixtures_cover_required_count_and_edge_cases():
    customers = _load("customers.json")

    assert len(customers) == 50
    assert {customer["id"] for customer in customers} == {f"CUS-{i:03d}" for i in range(1, 51)}
    assert any(customer["id_document"] is None for customer in customers)
    assert any(customer["risk_factors"]["is_pep"] for customer in customers)
    assert any(customer["risk_factors"]["high_risk_country"] for customer in customers)
    assert any(customer["risk_factors"]["sanctions_match"] == "near_match" for customer in customers)
    assert {customer["expected_decision"] for customer in customers} == {"APPROVE", "REVIEW", "REJECT"}


def test_screening_lists_and_documents_are_synthetic():
    sanctions = _load("sanctions_list.json")
    pep = _load("pep_list.json")
    documents = list((FIXTURES / "documents").glob("*.json"))

    assert len(sanctions) == 20
    assert len(pep) == 10
    assert len(documents) == 10
    assert all(entity["name"].startswith("SYNTHETIC-") for entity in sanctions)
    assert all(json.loads(path.read_text(encoding="utf-8"))["is_synthetic"] for path in documents)
