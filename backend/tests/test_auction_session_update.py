"""Test dello schema usato per aggiornare un'asta."""

import unittest

from pydantic import ValidationError

from backend.schemas import AuctionSessionUpdate


class AuctionSessionUpdateTests(unittest.TestCase):
    """Verifica rinomina e stati persistenti."""

    def test_normalizes_league_name(self) -> None:
        update = AuctionSessionUpdate(
            leagueName="  Asta   amici  "
        )

        self.assertEqual(
            update.leagueName,
            "Asta amici",
        )

    def test_accepts_completed_status(self) -> None:
        update = AuctionSessionUpdate(
            status="COMPLETED"
        )

        self.assertEqual(
            update.status,
            "COMPLETED",
        )

    def test_rejects_unknown_status(self) -> None:
        with self.assertRaises(ValidationError):
            AuctionSessionUpdate(
                status="UNKNOWN"  # type: ignore[arg-type]
            )

    def test_requires_at_least_one_change(self) -> None:
        with self.assertRaises(ValidationError):
            AuctionSessionUpdate()


if __name__ == "__main__":
    unittest.main()
