"""
Endpoint dedicati all'autenticazione
degli utenti Fantasy AI.

Gli endpoint disponibili sono:

- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET  /auth/me
"""

from fastapi import (
    APIRouter,
    Cookie,
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

from sqlalchemy.orm import Session

from backend.auth_security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_SECURE,
    AuthenticationError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

from backend.database import (
    get_database_session,
)

from backend.models import User

from backend.schemas import (
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def normalize_email(
    email: str,
) -> str:
    """
    Normalizza l'email prima
    del confronto e del salvataggio.
    """

    return (
        email
        .strip()
        .casefold()
    )


def create_user_response(
    user: User,
) -> UserResponse:
    """
    Converte il modello SQLAlchemy
    nella risposta pubblica dell'utente.
    """

    return UserResponse(
        id=user.id,
        email=user.email,

        displayName=(
            user.display_name
        ),

        isActive=user.is_active,

        createdAt=(
            user.created_at
        ),
    )


def set_authentication_cookie(
    response: Response,
    user: User,
) -> None:
    """
    Crea il JWT e lo salva
    in un cookie HttpOnly.
    """

    token = create_access_token(
        user.id
    )

    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,

        max_age=(
            ACCESS_TOKEN_EXPIRE_MINUTES
            * 60
        ),

        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/",
    )


def get_current_user(
    access_token: str | None = Cookie(
        default=None,
        alias=AUTH_COOKIE_NAME,
    ),

    database: Session = Depends(
        get_database_session
    ),
) -> User:
    """
    Recupera l'utente associato
    al cookie di autenticazione.
    """

    if access_token is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Autenticazione richiesta."
            ),
        )

    try:
        user_id = decode_access_token(
            access_token
        )

    except AuthenticationError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Sessione non valida "
                "oppure scaduta."
            ),
        ) from error

    user = database.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Utente non trovato."
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Questo account è disabilitato."
            ),
        )

    return user


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    request: UserRegisterRequest,
    response: Response,

    database: Session = Depends(
        get_database_session
    ),
) -> UserResponse:
    """
    Crea un nuovo account
    e autentica immediatamente l'utente.
    """

    normalized_email = normalize_email(
        str(request.email)
    )

    existing_user = database.scalar(
        select(User)
        .where(
            User.email
            == normalized_email
        )
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Esiste già un account "
                "associato a questa email."
            ),
        )

    user = User(
        email=normalized_email,

        display_name=(
            request.displayName
        ),

        password_hash=hash_password(
            request.password
        ),

        is_active=True,
    )

    try:
        database.add(
            user
        )

        database.commit()

        database.refresh(
            user
        )

    except IntegrityError as error:
        database.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Esiste già un account "
                "associato a questa email."
            ),
        ) from error

    except SQLAlchemyError as error:
        database.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail=(
                "Errore durante la creazione "
                "dell'account."
            ),
        ) from error

    set_authentication_cookie(
        response,
        user,
    )

    return create_user_response(
        user
    )


@router.post(
    "/login",
    response_model=UserResponse,
)
def login_user(
    request: UserLoginRequest,
    response: Response,

    database: Session = Depends(
        get_database_session
    ),
) -> UserResponse:
    """
    Verifica email e password
    e crea il cookie di autenticazione.
    """

    normalized_email = normalize_email(
        str(request.email)
    )

    user = database.scalar(
        select(User)
        .where(
            User.email
            == normalized_email
        )
    )

    if (
        user is None
        or not verify_password(
            request.password,
            user.password_hash
            if user is not None
            else "",
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Email o password non corretti."
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Questo account è disabilitato."
            ),
        )

    set_authentication_cookie(
        response,
        user,
    )

    return create_user_response(
        user
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_authenticated_user(
    current_user: User = Depends(
        get_current_user
    ),
) -> UserResponse:
    """
    Restituisce l'utente
    autenticato tramite cookie.
    """

    return create_user_response(
        current_user
    )


@router.post(
    "/logout",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
def logout_user(
    response: Response,
) -> Response:
    """
    Elimina il cookie
    di autenticazione.
    """

    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=AUTH_COOKIE_SECURE,
        httponly=True,
        samesite=AUTH_COOKIE_SAMESITE,
    )

    response.status_code = (
        status.HTTP_204_NO_CONTENT
    )

    return response