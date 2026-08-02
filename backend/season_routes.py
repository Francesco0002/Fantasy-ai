"""Endpoint del primo step della Modalità Stagione."""

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select

from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
)

from sqlalchemy.orm import Session

from backend.auth_routes import (
    get_current_user,
)

from backend.database import (
    get_database_session,
)

from backend.models import (
    SeasonLeague,
    User,
)

from backend.schemas import (
    SeasonLeagueCreate,
    SeasonLeagueListResponse,
    SeasonLeagueResponse,
)


router = APIRouter(
    prefix="/season-leagues",
    tags=["Season leagues"],
)


def create_league_response(
    league: SeasonLeague,
) -> SeasonLeagueResponse:
    """Converte il modello nella risposta pubblica."""

    return SeasonLeagueResponse(
        id=league.id,
        leagueName=league.league_name,
        teamName=league.team_name,
        season=league.season,
        mode="CLASSIC",
        createdAt=league.created_at,
        updatedAt=league.updated_at,
    )


def load_season_league(
    database: Session,
    league_id: UUID,
    user_id: UUID,
) -> SeasonLeague | None:
    """
    Recupera una lega soltanto quando appartiene
    all'utente autenticato.

    Per una lega inesistente e per una lega altrui
    restituiamo lo stesso risultato, così non viene
    rivelata l'esistenza dei dati di altri account.
    """

    statement = select(
        SeasonLeague
    ).where(
        SeasonLeague.id == league_id,
        SeasonLeague.user_id == user_id,
    )

    return database.scalar(
        statement
    )


@router.post(
    "",
    response_model=SeasonLeagueResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_season_league(
    request: SeasonLeagueCreate,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> SeasonLeagueResponse:
    """
    Crea una lega Classic per l'account autenticato.

    user_id non proviene mai dal corpo della richiesta:
    viene letto esclusivamente dal cookie autenticato.
    """

    league = SeasonLeague(
        user_id=current_user.id,
        league_name=request.leagueName,
        team_name=request.teamName,
        season=request.season,
        mode="CLASSIC",
    )

    try:
        database.add(
            league
        )

        database.commit()

        database.refresh(
            league
        )

    except IntegrityError as error:
        database.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Esiste già una lega con questo "
                "nome per la stagione indicata."
            ),
        ) from error

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Errore durante il salvataggio "
                "della lega stagionale."
            ),
        ) from error

    return create_league_response(
        league
    )


@router.get(
    "",
    response_model=SeasonLeagueListResponse,
)
def list_season_leagues(
    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> SeasonLeagueListResponse:
    """Restituisce soltanto le leghe dell'account."""

    statement = (
        select(SeasonLeague)
        .where(
            SeasonLeague.user_id
            == current_user.id
        )
        .order_by(
            SeasonLeague.updated_at.desc(),
            SeasonLeague.created_at.desc(),
        )
    )

    leagues = list(
        database.scalars(
            statement
        ).all()
    )

    responses = [
        create_league_response(
            league
        )
        for league in leagues
    ]

    return SeasonLeagueListResponse(
        count=len(responses),
        leagues=responses,
    )


@router.get(
    "/{league_id}",
    response_model=SeasonLeagueResponse,
)
def get_season_league(
    league_id: UUID,

    current_user: User = Depends(
        get_current_user
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> SeasonLeagueResponse:
    """
    Restituisce una lega dell'account oppure 404.

    Questo endpoint permette anche di verificare
    esplicitamente l'isolamento tra due utenti.
    """

    league = load_season_league(
        database,
        league_id,
        current_user.id,
    )

    if league is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail=(
                "Lega stagionale non trovata."
            ),
        )

    return create_league_response(
        league
    )
