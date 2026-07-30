"""
Endpoint dedicati alle sessioni d'asta.
"""

from datetime import (
    datetime,
    timezone,
)


from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)

from sqlalchemy import select

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)

from sqlalchemy.orm import (
    Session,
    selectinload,
)

from backend.auth_routes import (
    get_current_user,
)

from backend.database import (
    get_database_session,
)

from backend.models import (
    AuctionSession,
    Purchase,
    Team,
    User,
)

from backend.schemas import (
    AuctionSessionCreate,
    AuctionSessionListResponse,
    AuctionSessionResponse,
    AuctionSessionSummaryResponse,
    PurchaseCreate,
    PurchaseResponse,
    TeamResponse,
)


# Tutti gli endpoint definiti in questo file
# inizieranno con /auction-sessions.
router = APIRouter(
    prefix="/auction-sessions",
    tags=["Auction sessions"],
)


def load_auction_session(
    database: Session,
    session_id: UUID,
    user_id: UUID,
) -> AuctionSession | None:
    """
    Recupera una sessione appartenente
    all'utente autenticato insieme
    a squadre e acquisti.

    Restituendo None anche per le aste altrui
    evitiamo di rivelarne l'esistenza.
    """

    statement = (
        select(AuctionSession)
        .execution_options(
            populate_existing=True
        )
        .options(
            selectinload(
                AuctionSession.teams
            ),
            selectinload(
                AuctionSession.purchases
            ),
        )
        .where(
            AuctionSession.id
            == session_id,

            AuctionSession.user_id
            == user_id,
        )
    )

    return database.scalar(
        statement
    )


def create_session_response(
    auction_session: AuctionSession,
) -> AuctionSessionResponse:
    """
    Converte un modello SQLAlchemy
    nella risposta inviata al frontend.
    """

    sorted_teams = sorted(
        auction_session.teams,
        key=lambda team: (
            not team.is_user_team,
            team.created_at,
            team.name.casefold(),
        ),
    )

    sorted_purchases = sorted(
        auction_session.purchases,
        key=lambda purchase:
            purchase.purchased_at,
    )

    return AuctionSessionResponse(
        id=auction_session.id,

        leagueName=(
            auction_session.league_name
        ),

        participants=(
            auction_session.participants
        ),

        startingBudget=(
            auction_session.starting_budget
        ),

        minimumBid=(
            auction_session.minimum_bid
        ),

        rosterSlots=(
            auction_session.roster_slots
        ),

        budgetDistribution=(
            auction_session
            .budget_distribution
        ),

        auctionMode=(
            auction_session.auction_mode
        ),

        budgetStrategy=(
            auction_session
            .budget_strategy
        ),

        leagueRules=(
            auction_session
            .league_rules
        ),

        status=auction_session.status,

        createdAt=(
            auction_session.created_at
        ),

        updatedAt=(
            auction_session.updated_at
        ),

        teams=[
            TeamResponse(
                id=team.id,
                name=team.name,

                isUserTeam=(
                    team.is_user_team
                ),

                createdAt=(
                    team.created_at
                ),
            )
            for team in sorted_teams
        ],

        purchases=[
            PurchaseResponse(
                id=purchase.id,

                teamId=(
                    purchase.team_id
                ),

                playerId=(
                    purchase.player_id
                ),

                playerName=(
                    purchase.player_name
                ),

                playerTeam=(
                    purchase.player_team
                ),

                role=purchase.role,

                purchasePrice=(
                    purchase.purchase_price
                ),

                baseRecommendedPriceAtPurchase=(
                    purchase
                    .base_recommended_price_at_purchase
                ),

                dynamicRecommendedPriceAtPurchase=(
                    purchase
                    .dynamic_recommended_price_at_purchase
                ),

                purchasedAt=(
                    purchase.purchased_at
                ),
            )
            for purchase
            in sorted_purchases
        ],
    )


def create_session_summary_response(
    auction_session: AuctionSession,
) -> AuctionSessionSummaryResponse:
    """
    Converte una sessione d'asta
    nella versione sintetica utilizzata
    dalla pagina Le mie aste.
    """

    return AuctionSessionSummaryResponse(
        id=auction_session.id,

        leagueName=(
            auction_session.league_name
        ),

        participants=(
            auction_session.participants
        ),

        startingBudget=(
            auction_session.starting_budget
        ),

        auctionMode=(
            auction_session.auction_mode
        ),

        status=auction_session.status,

        teamsCount=len(
            auction_session.teams
        ),

        purchasesCount=len(
            auction_session.purchases
        ),

        createdAt=(
            auction_session.created_at
        ),

        updatedAt=(
            auction_session.updated_at
        ),
    )


def resolve_purchase_team(
    database: Session,
    auction_session: AuctionSession,
    request: PurchaseCreate,
) -> Team:
    """
    Individua la squadra che ha acquistato
    il giocatore.

    Per gli avversari inseriti manualmente,
    crea automaticamente una nuova squadra
    quando non esiste ancora.
    """

    if request.ownerType == "ME":
        user_team = next(
            (
                team
                for team
                in auction_session.teams
                if team.is_user_team
            ),
            None,
        )

        if user_team is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "La sessione non contiene "
                    "la squadra dell'utente."
                ),
            )

        return user_team

    # PurchaseCreate garantisce già
    # che ownerName non sia vuoto
    # quando ownerType è OPPONENT.
    opponent_name = request.ownerName

    if opponent_name is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Inserisci il nome della "
                "squadra avversaria."
            ),
        )

    normalized_opponent_name = (
        opponent_name.casefold()
    )

    # Cerchiamo una squadra già esistente
    # senza distinguere maiuscole e minuscole.
    existing_team = next(
        (
            team
            for team
            in auction_session.teams
            if (
                not team.is_user_team
                and team.name.casefold()
                == normalized_opponent_name
            )
        ),
        None,
    )

    if existing_team is not None:
        return existing_team

    current_opponents = [
        team
        for team
        in auction_session.teams
        if not team.is_user_team
    ]

    maximum_opponents = (
        auction_session.participants - 1
    )

    if (
        len(current_opponents)
        >= maximum_opponents
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Sono già state registrate "
                "tutte le squadre avversarie "
                "previste dalla sessione."
            ),
        )

    # Quando i nomi non erano stati inseriti
    # nella configurazione iniziale,
    # la squadra viene creata al primo acquisto.
    new_team = Team(
        auction_session=auction_session,
        name=opponent_name,
        is_user_team=False,
    )

    database.add(
        new_team
    )

    return new_team


def validate_purchase_constraints(
    auction_session: AuctionSession,
    purchase_team: Team,
    request: PurchaseCreate,
) -> None:
    """
    Controlla che l'acquisto rispetti:

    - stato della sessione;
    - unicità del giocatore;
    - offerta minima;
    - budget della squadra;
    - slot disponibili;
    - crediti necessari per completare la rosa.
    """

    if auction_session.status != "ACTIVE":
        raise HTTPException(
            status_code=409,
            detail=(
                "La sessione d'asta "
                "non è attiva."
            ),
        )

    # Il giocatore non può appartenere
    # a due squadre nella stessa asta.
    is_already_purchased = any(
        purchase.player_id
        == request.playerId
        for purchase
        in auction_session.purchases
    )

    if is_already_purchased:
        raise HTTPException(
            status_code=409,
            detail=(
                "Questo giocatore è già stato "
                "acquistato nella sessione."
            ),
        )

    if (
        request.purchasePrice
        < auction_session.minimum_bid
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Il prezzo deve essere almeno "
                f"{auction_session.minimum_bid} "
                "crediti."
            ),
        )

    # Per una squadra appena creata,
    # id può non essere ancora disponibile.
    #
    # In quel caso non esistono comunque
    # acquisti precedenti.
    if purchase_team.id is None:
        team_purchases: list[Purchase] = []
    else:
        team_purchases = [
            purchase
            for purchase
            in auction_session.purchases
            if (
                purchase.team_id
                == purchase_team.id
            )
        ]

    spent_budget = sum(
        purchase.purchase_price
        for purchase
        in team_purchases
    )

    remaining_budget = (
        auction_session.starting_budget
        - spent_budget
    )

    if (
        request.purchasePrice
        > remaining_budget
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Il prezzo supera il budget "
                "residuo della squadra."
            ),
        )

    purchased_by_role = {
        "P": 0,
        "D": 0,
        "C": 0,
        "A": 0,
    }

    for purchase in team_purchases:
        purchased_by_role[
            purchase.role
        ] += 1

    role_slot_limit = int(
        auction_session.roster_slots[
            request.role
        ]
    )

    if (
        purchased_by_role[
            request.role
        ]
        >= role_slot_limit
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "La squadra non ha più slot "
                f"disponibili per il ruolo "
                f"{request.role}."
            ),
        )

    total_remaining_slots = sum(
        max(
            int(
                auction_session
                .roster_slots[role]
            )
            - purchased_by_role[role],
            0,
        )
        for role in [
            "P",
            "D",
            "C",
            "A",
        ]
    )

    slots_after_purchase = max(
        total_remaining_slots - 1,
        0,
    )

    credits_to_reserve = (
        slots_after_purchase
        * auction_session.minimum_bid
    )

    maximum_bid = max(
        remaining_budget
        - credits_to_reserve,
        0,
    )

    if request.purchasePrice > maximum_bid:
        raise HTTPException(
            status_code=409,
            detail=(
                "Il prezzo non permette alla "
                "squadra di conservare i crediti "
                "necessari per completare la rosa. "
                f"Offerta massima: {maximum_bid}."
            ),
        )


@router.post(
    "",
    response_model=AuctionSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_auction_session(
    request: AuctionSessionCreate,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> AuctionSessionResponse:
    """
    Crea una sessione d'asta
    associata all'utente autenticato.
    """

    auction_session = AuctionSession(
        user_id=current_user.id,

        league_name=request.leagueName,

        participants=(
            request.participants
        ),

        starting_budget=(
            request.startingBudget
        ),

        minimum_bid=(
            request.minimumBid
        ),

        roster_slots=(
            request.rosterSlots
            .model_dump()
        ),

        budget_distribution=(
            request.budgetDistribution
            .model_dump()
        ),

        auction_mode=(
            request.auctionMode
        ),

        budget_strategy=(
            request.budgetStrategy
        ),

        league_rules=(
            request.leagueRules
            .model_dump()
        ),
    )

    try:
        database.add(
            auction_session
        )

        database.flush()

        user_team = Team(
            auction_session_id=(
                auction_session.id
            ),

            name=request.userTeamName,

            is_user_team=True,
        )

        database.add(
            user_team
        )

        for opponent_name in (
            request.opponentTeamNames
        ):
            opponent_team = Team(
                auction_session_id=(
                    auction_session.id
                ),

                name=opponent_name,

                is_user_team=False,
            )

            database.add(
                opponent_team
            )

        database.commit()

    except IntegrityError as error:
        database.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Non è stato possibile creare "
                "la sessione perché alcuni dati "
                "sono duplicati."
            ),
        ) from error

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Errore durante il salvataggio "
                "della sessione d'asta."
            ),
        ) from error

    stored_session = load_auction_session(
        database,
        auction_session.id,
        current_user.id,
    )

    if stored_session is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "La sessione è stata salvata "
                "ma non può essere recuperata."
            ),
        )

    return create_session_response(
        stored_session
    )


@router.get(
    "",
    response_model=AuctionSessionListResponse,
)
def list_auction_sessions(
    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> AuctionSessionListResponse:
    """
    Restituisce tutte le sessioni d'asta
    appartenenti all'utente autenticato.

    Le sessioni modificate più recentemente
    vengono mostrate per prime.
    """

    statement = (
        select(AuctionSession)
        .options(
            selectinload(
                AuctionSession.teams
            ),
            selectinload(
                AuctionSession.purchases
            ),
        )
        .where(
            AuctionSession.user_id
            == current_user.id
        )
        .order_by(
            AuctionSession.updated_at.desc(),
            AuctionSession.created_at.desc(),
        )
    )

    auction_sessions = list(
        database.scalars(
            statement
        ).all()
    )

    session_summaries = [
        create_session_summary_response(
            auction_session
        )
        for auction_session
        in auction_sessions
    ]

    return AuctionSessionListResponse(
        count=len(
            session_summaries
        ),

        sessions=session_summaries,
    )


@router.get(
    "/{session_id}",
    response_model=AuctionSessionResponse,
)
def get_auction_session(
    session_id: UUID,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> AuctionSessionResponse:
    """
    Recupera una sessione d'asta
    utilizzando il relativo UUID.
    """

    auction_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if auction_session is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sessione d'asta "
                "non trovata."
            ),
        )

    return create_session_response(
        auction_session
    )
    
    
@router.post(
    "/{session_id}/purchases",
    response_model=AuctionSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_purchase(
    session_id: UUID,
    request: PurchaseCreate,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> AuctionSessionResponse:
    """
    Registra un acquisto effettuato
    dall'utente oppure da un avversario.
    """

    auction_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if auction_session is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sessione d'asta "
                "non trovata."
            ),
        )

    purchase_team = resolve_purchase_team(
        database,
        auction_session,
        request,
    )

    validate_purchase_constraints(
        auction_session,
        purchase_team,
        request,
    )

    try:
        # Se la squadra è stata creata ora,
        # flush genera il relativo UUID.
        database.flush()

        purchase = Purchase(
            auction_session_id=(
                auction_session.id
            ),

            team_id=purchase_team.id,

            player_id=request.playerId,

            player_name=(
                request.playerName
            ),

            player_team=request.team,

            role=request.role,

            purchase_price=(
                request.purchasePrice
            ),

            base_recommended_price_at_purchase=(
                request
                .baseRecommendedPriceAtPurchase
            ),

            dynamic_recommended_price_at_purchase=(
                request
                .dynamicRecommendedPriceAtPurchase
            ),
        )

        database.add(
            purchase
        )

        # L'aggiunta di un acquisto deve
        # aggiornare anche la data
        # dell'ultima modifica della sessione.
        auction_session.updated_at = (
            datetime.now(
                timezone.utc
            )
        )

        database.commit()

    except IntegrityError as error:
        database.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Il giocatore risulta già "
                "acquistato oppure i dati "
                "violano un vincolo."
            ),
        ) from error

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Errore durante il salvataggio "
                "dell'acquisto."
            ),
        ) from error

    stored_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if stored_session is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "L'acquisto è stato salvato, "
                "ma la sessione non può "
                "essere recuperata."
            ),
        )

    return create_session_response(
        stored_session
    )
    
    
@router.delete(
    "/{session_id}/purchases/{player_id}",
    response_model=AuctionSessionResponse,
)
def delete_purchase(
    session_id: UUID,
    player_id: int,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> AuctionSessionResponse:
    """
    Elimina un acquisto utilizzando
    l'identificativo del giocatore.
    """

    auction_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if auction_session is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sessione d'asta "
                "non trovata."
            ),
        )

    purchase_to_delete = next(
        (
            purchase
            for purchase
            in auction_session.purchases
            if (
                purchase.player_id
                == player_id
            )
        ),
        None,
    )

    if purchase_to_delete is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Acquisto non trovato "
                "nella sessione."
            ),
        )

    try:
        database.delete(
            purchase_to_delete
        )

        auction_session.updated_at = (
            datetime.now(
                timezone.utc
            )
        )

        database.commit()

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Errore durante l'eliminazione "
                "dell'acquisto."
            ),
        ) from error

    stored_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if stored_session is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "L'acquisto è stato eliminato, "
                "ma la sessione non può "
                "essere recuperata."
            ),
        )

    return create_session_response(
        stored_session
    )
    
    
@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_auction_session(
    session_id: UUID,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> Response:
    """
    Elimina definitivamente una sessione
    insieme a squadre e acquisti.

    Le relazioni vengono eliminate
    automaticamente grazie a ON DELETE CASCADE.
    """

    auction_session = load_auction_session(
        database,
        session_id,
        current_user.id,
    )

    if auction_session is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sessione d'asta "
                "non trovata."
            ),
        )

    try:
        database.delete(
            auction_session
        )

        database.commit()

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Errore durante l'eliminazione "
                "della sessione d'asta."
            ),
        ) from error

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )