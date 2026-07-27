"""
Schemi Pydantic utilizzati dagli endpoint
della modalità asta.

Gli schemi:

- validano i dati ricevuti dal frontend;
- descrivono le risposte dell'API;
- vengono mostrati automaticamente in /docs.
"""

from datetime import datetime
from math import isclose
from typing import Literal, Self
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    field_validator,
    model_validator,
)


# Ruoli ammessi dal Fantacalcio Classic.
AuctionRole = Literal[
    "P",
    "D",
    "C",
    "A",
]


# Modalità supportate dall'asta.
AuctionMode = Literal[
    "ROLE_BY_ROLE",
    "FULL_RANDOM",
]


# Possibili destinatari di un acquisto.
AuctionPurchaseOwner = Literal[
    "ME",
    "OPPONENT",
]


class RosterSlotsSchema(BaseModel):
    """
    Numero di giocatori acquistabili
    per ciascun ruolo.
    """

    P: int = Field(ge=0, le=20)
    D: int = Field(ge=0, le=20)
    C: int = Field(ge=0, le=20)
    A: int = Field(ge=0, le=20)


class BudgetDistributionSchema(BaseModel):
    """
    Percentuale del budget assegnata
    a ciascun ruolo.
    """

    P: float = Field(ge=0, le=1)
    D: float = Field(ge=0, le=1)
    C: float = Field(ge=0, le=1)
    A: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_total(
        self,
    ) -> Self:
        """
        La distribuzione complessiva
        deve essere pari al 100%.
        """

        total = (
            self.P
            + self.D
            + self.C
            + self.A
        )

        if not isclose(
            total,
            1.0,
            abs_tol=0.0001,
        ):
            raise ValueError(
                "La distribuzione del budget "
                "deve essere pari al 100%."
            )

        return self


class AuctionSessionCreate(BaseModel):
    """
    Dati ricevuti quando il frontend
    avvia una nuova asta.

    I nomi dei campi sono uguali
    a quelli utilizzati dal frontend.
    """

    leagueName: str = Field(
        min_length=1,
        max_length=120,
    )

    participants: int = Field(
        ge=2,
        le=30,
    )

    startingBudget: int = Field(
        gt=0,
    )

    minimumBid: int = Field(
        gt=0,
    )

    rosterSlots: RosterSlotsSchema

    budgetDistribution: BudgetDistributionSchema

    auctionMode: AuctionMode

    # Nome della squadra dell'utente.
    #
    # Il frontend per ora non lo richiede,
    # quindi viene usato un valore predefinito.
    userTeamName: str = Field(
        default="La mia squadra",
        min_length=1,
        max_length=120,
    )

    # Elenco opzionale delle squadre avversarie.
    opponentTeamNames: list[str] = Field(
        default_factory=list,
    )

    @field_validator(
        "leagueName",
        "userTeamName",
    )
    @classmethod
    def normalize_required_names(
        cls,
        value: str,
    ) -> str:
        """
        Elimina gli spazi superflui
        dai testi obbligatori.
        """

        normalized_value = value.strip()

        if normalized_value == "":
            raise ValueError(
                "Il testo non può essere vuoto."
            )

        return normalized_value

    @field_validator(
        "opponentTeamNames",
    )
    @classmethod
    def normalize_opponent_names(
        cls,
        values: list[str],
    ) -> list[str]:
        """
        Pulisce e controlla i nomi
        delle squadre avversarie.
        """

        normalized_names: list[str] = []

        for value in values:
            normalized_value = value.strip()

            if normalized_value == "":
                raise ValueError(
                    "Il nome di una squadra "
                    "avversaria non può essere vuoto."
                )

            if len(normalized_value) > 120:
                raise ValueError(
                    "Il nome di una squadra "
                    "non può superare 120 caratteri."
                )

            normalized_names.append(
                normalized_value
            )

        return normalized_names

    @model_validator(mode="after")
    def validate_configuration(
        self,
    ) -> Self:
        """
        Controlla la coerenza complessiva
        della configurazione.
        """

        if (
            self.minimumBid
            > self.startingBudget
        ):
            raise ValueError(
                "L'offerta minima non può "
                "superare il budget iniziale."
            )

        total_roster_slots = (
            self.rosterSlots.P
            + self.rosterSlots.D
            + self.rosterSlots.C
            + self.rosterSlots.A
        )

        if total_roster_slots <= 0:
            raise ValueError(
                "La rosa deve contenere "
                "almeno un giocatore."
            )

        minimum_required_budget = (
            total_roster_slots
            * self.minimumBid
        )

        if (
            self.startingBudget
            < minimum_required_budget
        ):
            raise ValueError(
                "Il budget iniziale non permette "
                "di completare tutti gli slot."
            )

        opponent_names = (
            self.opponentTeamNames
        )

        # Quando vengono inseriti i nomi,
        # devono essere presenti tutti gli avversari.
        if opponent_names:
            expected_opponents = (
                self.participants - 1
            )

            if (
                len(opponent_names)
                != expected_opponents
            ):
                raise ValueError(
                    "Il numero delle squadre "
                    "avversarie deve essere pari "
                    f"a {expected_opponents}."
                )

        normalized_opponent_names = [
            team_name.casefold()
            for team_name
            in opponent_names
        ]

        if (
            len(
                set(
                    normalized_opponent_names
                )
            )
            != len(
                normalized_opponent_names
            )
        ):
            raise ValueError(
                "I nomi delle squadre avversarie "
                "non possono essere duplicati."
            )

        if (
            self.userTeamName.casefold()
            in normalized_opponent_names
        ):
            raise ValueError(
                "La squadra dell'utente "
                "non può avere lo stesso nome "
                "di una squadra avversaria."
            )

        return self


class PurchaseCreate(BaseModel):
    """
    Dati ricevuti quando viene registrato
    un acquisto durante l'asta.
    """

    # Identificativo del giocatore
    # proveniente dal CSV.
    playerId: int = Field(
        gt=0,
    )

    # Nome del calciatore.
    playerName: str = Field(
        min_length=1,
        max_length=160,
    )

    # Squadra reale del calciatore.
    #
    # Non rappresenta la squadra
    # che lo ha acquistato.
    team: str = Field(
        min_length=1,
        max_length=120,
    )

    # P, D, C oppure A.
    role: AuctionRole

    # Prezzo finale pagato.
    purchasePrice: int = Field(
        gt=0,
    )

    # ME oppure OPPONENT.
    ownerType: AuctionPurchaseOwner

    # Nome della squadra avversaria.
    #
    # È obbligatorio soltanto quando
    # ownerType è OPPONENT.
    ownerName: str | None = Field(
        default=None,
        max_length=120,
    )

    # Quotazione originale al momento
    # dell'acquisto.
    baseRecommendedPriceAtPurchase: int | None = Field(
            default=None,
            ge=0,
        )

    # Quotazione dinamica al momento
    # dell'acquisto.
    dynamicRecommendedPriceAtPurchase: int | None = Field(
            default=None,
            ge=0,
        )

    @field_validator(
        "playerName",
        "team",
    )
    @classmethod
    def normalize_player_text(
        cls,
        value: str,
    ) -> str:
        """
        Elimina gli spazi superflui
        dai dati del giocatore.
        """

        normalized_value = value.strip()

        if normalized_value == "":
            raise ValueError(
                "Il testo non può essere vuoto."
            )

        return normalized_value

    @field_validator(
        "ownerName",
    )
    @classmethod
    def normalize_owner_name(
        cls,
        value: str | None,
    ) -> str | None:
        """
        Normalizza il nome della squadra
        che ha effettuato l'acquisto.
        """

        if value is None:
            return None

        normalized_value = value.strip()

        if normalized_value == "":
            return None

        return normalized_value

    @model_validator(mode="after")
    def validate_owner(
        self,
    ) -> Self:
        """
        Per un acquisto avversario
        deve essere indicato il nome
        della squadra proprietaria.
        """

        if (
            self.ownerType == "OPPONENT"
            and self.ownerName is None
        ):
            raise ValueError(
                "Inserisci il nome della "
                "squadra avversaria."
            )

        return self


class TeamResponse(BaseModel):
    """
    Squadra restituita dall'API.
    """

    id: UUID
    name: str
    isUserTeam: bool
    createdAt: datetime


class PurchaseResponse(BaseModel):
    """
    Acquisto restituito insieme
    alla sessione d'asta.
    """

    id: UUID
    teamId: UUID

    playerId: int
    playerName: str
    playerTeam: str

    role: AuctionRole
    purchasePrice: int

    baseRecommendedPriceAtPurchase: int | None

    dynamicRecommendedPriceAtPurchase: int | None

    purchasedAt: datetime


class AuctionSessionResponse(BaseModel):
    """
    Sessione completa restituita dall'API.
    """

    id: UUID

    leagueName: str
    participants: int

    startingBudget: int
    minimumBid: int

    rosterSlots: RosterSlotsSchema

    budgetDistribution: BudgetDistributionSchema

    auctionMode: AuctionMode
    status: str

    createdAt: datetime
    updatedAt: datetime

    teams: list[TeamResponse]
    purchases: list[PurchaseResponse]