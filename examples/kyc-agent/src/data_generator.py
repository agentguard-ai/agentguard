"""Generate deterministic, obviously synthetic KYC fixtures for agent tests."""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "fixtures"


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def generate(output_dir: Path = ROOT) -> None:
    customers = []
    for index in range(1, 51):
        customer_id = f"CUS-{index:03d}"
        risk = {
            "is_pep": index == 4,
            "high_risk_country": index == 5,
            "sanctions_match": "near_match" if index == 3 else "none",
            "adverse_media": index == 6,
        }
        decision = "REJECT" if index == 3 else "REVIEW" if any(risk.values()) else "APPROVE"
        document = None if index == 2 else {
            "type": "passport",
            "number": f"TEST-DOC-{index:03d}",
            "expiry": f"203{index % 10}-01-01",
            "extracted_fields": {"first_name": f"Test{index:03d}"},
        }
        customers.append(
            {
                "id": customer_id,
                "first_name": f"Test{index:03d}",
                "last_name": "Synthetic",
                "date_of_birth": str(date(1980, 1, 1) + timedelta(days=index * 31)),
                "nationality": "ZZ",
                "country_of_residence": "ZZ",
                "occupation": "Synthetic Tester",
                "source_of_funds": "Synthetic Employment",
                "expected_monthly_transactions": index * 100,
                "id_document": document,
                "risk_factors": risk,
                "expected_decision": decision,
            }
        )

    _write_json(output_dir / "customers.json", customers)
    _write_json(
        output_dir / "sanctions_list.json",
        [
            {"id": f"SAN-{index:03d}", "name": f"SYNTHETIC-ENTITY-{index:03d}", "country": "ZZ"}
            for index in range(1, 21)
        ],
    )
    _write_json(
        output_dir / "pep_list.json",
        [
            {"id": f"PEP-{index:03d}", "name": f"Synthetic Public Official {index:03d}", "country": "ZZ"}
            for index in range(1, 11)
        ],
    )
    documents_dir = output_dir / "documents"
    for index in range(1, 11):
        _write_json(
            documents_dir / f"document-{index:03d}.json",
            {
                "document_id": f"DOC-{index:03d}",
                "document_type": "passport",
                "document_number": f"TEST-DOC-{index:03d}",
                "issuing_country": "ZZ",
                "extracted_fields": {"first_name": f"Test{index:03d}", "last_name": "Synthetic"},
                "is_synthetic": True,
            },
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT)
    generate(parser.parse_args().output_dir)
