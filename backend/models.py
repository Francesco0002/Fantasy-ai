"""
Modelli SQLAlchemy utilizzati
dalla modalità asta.

In questa prima versione salviamo:

- configurazione della sessione;
- squadre partecipanti;
- acquisti registrati.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)

from sqlalchemy.dialects.postgresql import (
    JSONB,
    UUID as PostgreSQLUUID,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from backend.database import Base


class User(Base):
    """
    Account registrato su Fantasy AI.

    La password non viene mai salvata
    direttamente: conserviamo soltanto
    l'hash generato con Argon2.
    """

    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "email",
            name="uq_users_email",
        ),
    )

    # Identificativo pubblico dell'utente.
    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # L'email verrà normalizzata
    # prima del salvataggio.
    email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
    )

    # Nome mostrato nell'interfaccia.
    display_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    # Hash Argon2 della password.
    # Non contiene mai la password originale.
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Permette di disabilitare un account
    # senza eliminarne lo storico.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # Data di registrazione.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Data dell'ultima modifica.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AuctionSession(Base):
    """
    Sessione completa di una singola asta.

    Il budget residuo e gli slot residui
    saranno ricalcolati partendo dagli acquisti.
    """

    __tablename__ = "auction_sessions"

    __table_args__ = (
        CheckConstraint(
            "participants >= 2",
            name=(
                "ck_auction_sessions_"
                "participants_min"
            ),
        ),

        CheckConstraint(
            "starting_budget > 0",
            name=(
                "ck_auction_sessions_"
                "starting_budget_positive"
            ),
        ),

        CheckConstraint(
            "minimum_bid > 0",
            name=(
                "ck_auction_sessions_"
                "minimum_bid_positive"
            ),
        ),

        CheckConstraint(
            (
                "auction_mode IN "
                "('ROLE_BY_ROLE', 'FULL_RANDOM')"
            ),
            name=(
                "ck_auction_sessions_"
                "auction_mode_valid"
            ),
        ),

        CheckConstraint(
            (
                "budget_strategy IN "
                "('AUTOMATIC', 'MANUAL')"
            ),
            name=(
                "ck_auction_sessions_"
                "budget_strategy_valid"
            ),
        ),
    )

    # Identificativo pubblico della sessione.
    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Nome assegnato alla lega.
    league_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    # Numero totale di partecipanti,
    # inclusa la squadra dell'utente.
    participants: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Budget iniziale disponibile
    # per ciascuna squadra.
    starting_budget: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Offerta minima prevista dalla lega.
    minimum_bid: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # ROLE_BY_ROLE oppure FULL_RANDOM.
    auction_mode: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    # Esempio:
    #
    # {
    #     "P": 3,
    #     "D": 8,
    #     "C": 8,
    #     "A": 6
    # }
    roster_slots: Mapped[
        dict[str, int]
    ] = mapped_column(
        JSONB,
        nullable=False,
    )

    # Esempio:
    #
    # {
    #     "P": 0.08,
    #     "D": 0.18,
    #     "C": 0.34,
    #     "A": 0.40
    # }
    budget_distribution: Mapped[
        dict[str, float]
    ] = mapped_column(
        JSONB,
        nullable=False,
    )

    # AUTOMATIC:
    # il frontend calcola la distribuzione
    # in base alle regole della lega.
    #
    # MANUAL:
    # l'utente inserisce direttamente
    # le percentuali del budget.
    budget_strategy: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )


    # Bonus, malus e modificatori
    # configurati per questa sessione.
    #
    # La struttura viene salvata come JSONB
    # perché contiene oggetti e array annidati.
    league_rules: Mapped[
        dict[str, object]
    ] = mapped_column(
        JSONB,
        nullable=False,
    )

    # ACTIVE indica un'asta in corso.
    # In futuro potremo usare anche
    # COMPLETED oppure CANCELLED.
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default="ACTIVE",
    )

    # Data di creazione.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Data dell'ultima modifica.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Squadre appartenenti alla sessione.
    teams: Mapped[list["Team"]] = relationship(
        back_populates="auction_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Acquisti appartenenti alla sessione.
    purchases: Mapped[
        list["Purchase"]
    ] = relationship(
        back_populates="auction_session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Team(Base):
    """
    Squadra partecipante a una sessione.

    Una squadra può rappresentare:
    - la rosa dell'utente;
    - una squadra avversaria.
    """

    __tablename__ = "teams"

    __table_args__ = (
        # All'interno della stessa asta
        # non possono esistere due squadre
        # con esattamente lo stesso nome.
        UniqueConstraint(
            "auction_session_id",
            "name",
            name="uq_teams_session_name",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Sessione alla quale appartiene.
    auction_session_id: Mapped[
        UUID
    ] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "auction_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Nome visualizzato nel frontend.
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    # True soltanto per la squadra dell'utente.
    is_user_team: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    auction_session: Mapped[
        "AuctionSession"
    ] = relationship(
        back_populates="teams",
    )

    purchases: Mapped[
        list["Purchase"]
    ] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Purchase(Base):
    """
    Singolo giocatore acquistato durante l'asta.

    Salviamo anche nome, squadra reale e ruolo
    come fotografia storica del giocatore.
    """

    __tablename__ = "purchases"

    __table_args__ = (
        # Lo stesso giocatore non può essere
        # acquistato due volte nella stessa asta.
        UniqueConstraint(
            "auction_session_id",
            "player_id",
            name=(
                "uq_purchases_"
                "session_player"
            ),
        ),

        CheckConstraint(
            (
                "role IN "
                "('P', 'D', 'C', 'A')"
            ),
            name="ck_purchases_role_valid",
        ),

        CheckConstraint(
            "purchase_price > 0",
            name=(
                "ck_purchases_"
                "price_positive"
            ),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Sessione nella quale è avvenuto
    # l'acquisto.
    auction_session_id: Mapped[
        UUID
    ] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "auction_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Squadra proprietaria del giocatore.
    team_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "teams.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # Identificativo proveniente dal CSV.
    player_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Fotografia del nome del giocatore.
    player_name: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
    )

    # Squadra reale del calciatore.
    player_team: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    # P, D, C oppure A.
    role: Mapped[str] = mapped_column(
        String(1),
        nullable=False,
    )

    # Prezzo finale pagato.
    purchase_price: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Quotazione originale disponibile
    # quando è stato registrato l'acquisto.
    base_recommended_price_at_purchase: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )

    # Quotazione dinamica disponibile
    # nello stesso momento.
    dynamic_recommended_price_at_purchase: Mapped[
        int | None
    ] = mapped_column(
        Integer,
        nullable=True,
    )

    purchased_at: Mapped[
        datetime
    ] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    auction_session: Mapped[
        "AuctionSession"
    ] = relationship(
        back_populates="purchases",
    )

    team: Mapped["Team"] = relationship(
        back_populates="purchases",
    )