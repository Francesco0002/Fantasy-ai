"""Test del primo step della Modalità Stagione."""

import os
import unittest
from uuid import UUID

# Permette di importare il backend anche in un ambiente
# di test che non possiede un database PostgreSQL reale.
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite+pysqlite:///:memory:",
)

os.environ.setdefault(
    "AUTH_JWT_SECRET",
    "test-only-secret-not-used-in-production",
)

from fastapi import HTTPException  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from sqlalchemy import create_engine, delete, select  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from backend.auth_routes import get_current_user  # noqa: E402
from backend.models import SeasonLeague, User  # noqa: E402
from backend.schemas import SeasonLeagueCreate  # noqa: E402
from backend.season_routes import (  # noqa: E402
    create_season_league,
    get_season_league,
    list_season_leagues,
)


class SeasonLeagueSchemaTests(unittest.TestCase):
    """Verifica il contratto ricevuto dal client."""

    def test_normalizes_names_and_accepts_season(self) -> None:
        request = SeasonLeagueCreate(
            leagueName="  Lega   Amici  ",
            teamName="  FC   Test  ",
            season="2026/27",
        )

        self.assertEqual(
            request.leagueName,
            "Lega Amici",
        )

        self.assertEqual(
            request.teamName,
            "FC Test",
        )

    def test_rejects_non_consecutive_season(self) -> None:
        with self.assertRaises(ValidationError):
            SeasonLeagueCreate(
                leagueName="Lega Amici",
                teamName="FC Test",
                season="2026/28",
            )

    def test_rejects_user_id_from_client(self) -> None:
        with self.assertRaises(ValidationError):
            SeasonLeagueCreate.model_validate(
                {
                    "leagueName": "Lega Amici",
                    "teamName": "FC Test",
                    "season": "2026/27",
                    "userId": (
                        "00000000-0000-0000-"
                        "0000-000000000001"
                    ),
                }
            )


class SeasonLeagueAccountIsolationTests(unittest.TestCase):
    """Verifica persistenza e isolamento tra account."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={
                "check_same_thread": False,
            },
            poolclass=StaticPool,
        )

        User.__table__.create(
            cls.engine
        )

        SeasonLeague.__table__.create(
            cls.engine
        )

        cls.session_factory = sessionmaker(
            bind=cls.engine,
            expire_on_commit=False,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        with self.session_factory() as database:
            database.execute(
                delete(SeasonLeague)
            )

            database.execute(
                delete(User)
            )

            self.user_a = User(
                email="account-a@example.com",
                display_name="Account A",
                password_hash="test-only",
            )

            self.user_b = User(
                email="account-b@example.com",
                display_name="Account B",
                password_hash="test-only",
            )

            database.add_all(
                [
                    self.user_a,
                    self.user_b,
                ]
            )

            database.commit()

    def create_request(self) -> SeasonLeagueCreate:
        """Crea la richiesta minima condivisa dai test."""

        return SeasonLeagueCreate(
            leagueName="Lega Amici",
            teamName="FC Test",
            season="2026/27",
        )

    def test_requires_authentication(self) -> None:
        with self.session_factory() as database:
            with self.assertRaises(HTTPException) as context:
                get_current_user(
                    access_token=None,
                    database=database,
                )

        self.assertEqual(
            context.exception.status_code,
            401,
        )

    def test_uses_authenticated_user_as_owner(self) -> None:
        with self.session_factory() as database:
            response = create_season_league(
                self.create_request(),
                current_user=self.user_a,
                database=database,
            )

            stored_league = database.scalar(
                select(SeasonLeague).where(
                    SeasonLeague.id
                    == response.id
                )
            )

            self.assertIsNotNone(
                stored_league
            )

            if stored_league is None:
                self.fail(
                    "La lega non è stata salvata."
                )

            self.assertEqual(
                stored_league.user_id,
                self.user_a.id,
            )

            self.assertEqual(
                response.mode,
                "CLASSIC",
            )

    def test_account_cannot_list_or_open_another_league(
        self,
    ) -> None:
        with self.session_factory() as database:
            created = create_season_league(
                self.create_request(),
                current_user=self.user_a,
                database=database,
            )

            user_b_list = list_season_leagues(
                current_user=self.user_b,
                database=database,
            )

            self.assertEqual(
                user_b_list.count,
                0,
            )

            with self.assertRaises(HTTPException) as context:
                get_season_league(
                    UUID(str(created.id)),
                    current_user=self.user_b,
                    database=database,
                )

            self.assertEqual(
                context.exception.status_code,
                404,
            )

            user_a_list = list_season_leagues(
                current_user=self.user_a,
                database=database,
            )

            self.assertEqual(
                user_a_list.count,
                1,
            )

    def test_same_league_name_is_allowed_for_two_accounts(
        self,
    ) -> None:
        with self.session_factory() as database:
            create_season_league(
                self.create_request(),
                current_user=self.user_a,
                database=database,
            )

            create_season_league(
                self.create_request(),
                current_user=self.user_b,
                database=database,
            )

            stored_leagues = list(
                database.scalars(
                    select(SeasonLeague)
                ).all()
            )

            self.assertEqual(
                len(stored_leagues),
                2,
            )

    def test_duplicate_league_is_rejected_for_same_account(
        self,
    ) -> None:
        with self.session_factory() as database:
            create_season_league(
                self.create_request(),
                current_user=self.user_a,
                database=database,
            )

            with self.assertRaises(HTTPException) as context:
                create_season_league(
                    self.create_request(),
                    current_user=self.user_a,
                    database=database,
                )

            self.assertEqual(
                context.exception.status_code,
                409,
            )


if __name__ == "__main__":
    unittest.main()
