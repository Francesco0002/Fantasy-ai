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
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


class UserRegisterRequest(BaseModel):
    """
    Dati richiesti per creare
    un nuovo account Fantasy AI.
    """

    email: EmailStr

    displayName: str = Field(
        min_length=1,
        max_length=80,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator(
        "displayName",
    )
    @classmethod
    def normalize_display_name(
        cls,
        value: str,
    ) -> str:
        """
        Elimina gli spazi superflui
        dal nome visualizzato.
        """

        normalized_value = " ".join(
            value.split()
        )

        if normalized_value == "":
            raise ValueError(
                "Il nome non può essere vuoto."
            )

        return normalized_value


class UserLoginRequest(BaseModel):
    """
    Credenziali utilizzate
    per accedere all'account.
    """

    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    """
    Informazioni pubbliche dell'utente.

    Password e relativo hash
    non vengono mai restituiti.
    """

    id: UUID

    email: EmailStr

    displayName: str

    isActive: bool

    createdAt: datetime


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


# Modalità di gestione del budget.
AuctionBudgetStrategy = Literal[
    "AUTOMATIC",
    "MANUAL",
]


# Stati persistenti di una sessione d'asta.
AuctionSessionStatus = Literal[
    "ACTIVE",
    "COMPLETED",
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


class GoalBonusByRoleSchema(BaseModel):
    """
    Bonus assegnato al gol
    in base al ruolo del giocatore.
    """

    P: float = Field(
        default=3,
        ge=-20,
        le=20,
    )

    D: float = Field(
        default=3,
        ge=-20,
        le=20,
    )

    C: float = Field(
        default=3,
        ge=-20,
        le=20,
    )

    A: float = Field(
        default=3,
        ge=-20,
        le=20,
    )


class AuctionScoringRulesSchema(BaseModel):
    """
    Bonus e malus utilizzati
    dalla lega.
    """

    goalByRole: GoalBonusByRoleSchema = Field(
        default_factory=GoalBonusByRoleSchema,
    )

    assist: float = Field(
        default=1,
        ge=-20,
        le=20,
    )

    cleanSheet: float = Field(
        default=1,
        ge=-20,
        le=20,
    )

    goalConceded: float = Field(
        default=-1,
        ge=-20,
        le=20,
    )

    penaltyScored: float = Field(
        default=3,
        ge=-20,
        le=20,
    )

    penaltyMissed: float = Field(
        default=-3,
        ge=-20,
        le=20,
    )

    penaltySaved: float = Field(
        default=3,
        ge=-20,
        le=20,
    )

    yellowCard: float = Field(
        default=-0.5,
        ge=-20,
        le=20,
    )

    redCard: float = Field(
        default=-1,
        ge=-20,
        le=20,
    )

    ownGoal: float = Field(
        default=-2,
        ge=-20,
        le=20,
    )


class ModifierBandSchema(BaseModel):
    """
    Fascia media-bonus utilizzata
    dai modificatori.
    """

    minimumAverage: float = Field(
        ge=0,
        le=10,
    )

    bonus: float = Field(
        ge=-20,
        le=20,
    )


def create_default_modifier_bands(
) -> list[ModifierBandSchema]:
    """
    Crea le fasce predefinite
    senza condividere la stessa lista
    tra configurazioni differenti.
    """

    return [
        ModifierBandSchema(
            minimumAverage=6,
            bonus=1,
        ),

        ModifierBandSchema(
            minimumAverage=6.25,
            bonus=2,
        ),

        ModifierBandSchema(
            minimumAverage=6.5,
            bonus=3,
        ),

        ModifierBandSchema(
            minimumAverage=7,
            bonus=6,
        ),
    ]


class DefenseModifierRulesSchema(BaseModel):
    """
    Configurazione del modificatore difesa.
    """

    enabled: bool = False

    minimumDefenders: int = Field(
        default=4,
        ge=1,
        le=20,
    )

    includeGoalkeeper: bool = True

    consideredPlayers: int = Field(
        default=4,
        ge=1,
        le=20,
    )

    bands: list[
        ModifierBandSchema
    ] = Field(
        default_factory=(
            create_default_modifier_bands
        ),
        min_length=1,
        max_length=20,
    )


class MidfieldModifierRulesSchema(BaseModel):
    """
    Configurazione del modificatore
    centrocampo.
    """

    enabled: bool = False

    minimumMidfielders: int = Field(
        default=4,
        ge=1,
        le=20,
    )

    consideredPlayers: int = Field(
        default=4,
        ge=1,
        le=20,
    )

    bands: list[
        ModifierBandSchema
    ] = Field(
        default_factory=(
            create_default_modifier_bands
        ),
        min_length=1,
        max_length=20,
    )


class AuctionLeagueRulesSchema(BaseModel):
    """
    Regole complete della lega.
    """

    scoring: AuctionScoringRulesSchema = Field(
        default_factory=(
            AuctionScoringRulesSchema
        ),
    )

    defenseModifier: DefenseModifierRulesSchema = Field(
        default_factory=(
            DefenseModifierRulesSchema
        ),
    )

    midfieldModifier: MidfieldModifierRulesSchema = Field(
        default_factory=(
            MidfieldModifierRulesSchema
        ),
    )


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

    # Le vecchie versioni del frontend
    # che non inviano questo campo
    # conservano il budget salvato manualmente.
    budgetStrategy: AuctionBudgetStrategy = (
        "MANUAL"
    )

    # Bonus, malus e modificatori.
    leagueRules: AuctionLeagueRulesSchema = Field(
        default_factory=(
            AuctionLeagueRulesSchema
        ),
    )

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


class AuctionSessionUpdate(BaseModel):
    """
    Campi modificabili dopo la creazione.

    Tutti i campi sono opzionali, ma la richiesta
    deve contenerne almeno uno.
    """

    leagueName: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
    )

    status: AuctionSessionStatus | None = None

    @field_validator("leagueName")
    @classmethod
    def normalize_optional_league_name(
        cls,
        value: str | None,
    ) -> str | None:
        """Elimina gli spazi superflui dal nome."""

        if value is None:
            return None

        normalized_value = " ".join(
            value.split()
        )

        if normalized_value == "":
            raise ValueError(
                "Il nome dell'asta non può essere vuoto."
            )

        return normalized_value

    @model_validator(mode="after")
    def require_at_least_one_change(
        self,
    ) -> Self:
        """Rifiuta richieste PATCH prive di modifiche."""

        if (
            self.leagueName is None
            and self.status is None
        ):
            raise ValueError(
                "Indica almeno un campo da modificare."
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

    budgetStrategy: AuctionBudgetStrategy

    leagueRules: AuctionLeagueRulesSchema

    status: AuctionSessionStatus

    createdAt: datetime
    updatedAt: datetime

    teams: list[TeamResponse]
    purchases: list[PurchaseResponse]


class ContextualPlayerPriceResponse(BaseModel):
    """
    Quotazioni di un giocatore ricalcolate
    secondo le impostazioni dell'asta.
    """

    player_id: int = Field(
        gt=0,
    )

    base_price: float = Field(
        ge=0,
    )

    recommended_min: int = Field(
        ge=0,
    )

    recommended_price: int = Field(
        ge=0,
    )

    recommended_max: int = Field(
        ge=0,
    )

    absolute_max: int = Field(
        ge=0,
    )

    market_coverage: float = Field(
        ge=0,
        le=100,
    )

    price_rank: int = Field(
        gt=0,
    )


class ContextualPlayerPricesResponse(BaseModel):
    """
    Elenco delle quotazioni calcolate
    per una specifica sessione d'asta.
    """

    sessionId: UUID

    count: int = Field(
        ge=0,
    )

    players: list[
        ContextualPlayerPriceResponse
    ]


class AuctionSessionSummaryResponse(BaseModel):
    """
    Informazioni sintetiche utilizzate
    nell'elenco delle aste dell'utente.
    """

    id: UUID

    leagueName: str
    participants: int
    startingBudget: int

    auctionMode: AuctionMode

    status: AuctionSessionStatus

    teamsCount: int
    purchasesCount: int

    createdAt: datetime
    updatedAt: datetime


class AuctionSessionListResponse(BaseModel):
    """
    Elenco delle sessioni d'asta
    appartenenti all'utente autenticato.
    """

    count: int

    sessions: list[
        AuctionSessionSummaryResponse
    ]
