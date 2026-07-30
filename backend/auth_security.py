"""
Funzioni di sicurezza utilizzate
dall'autenticazione di Fantasy AI.

Questo modulo gestisce:

- hash delle password con Argon2;
- verifica delle password;
- creazione dei token JWT;
- validazione dei token JWT.
"""

import os

from datetime import (
    datetime,
    timedelta,
    timezone,
)

from pathlib import Path
from uuid import UUID

import jwt

from dotenv import load_dotenv

from jwt import InvalidTokenError

from pwdlib import PasswordHash


# Cartella principale fantasy-ai.
PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)


# Caricamento delle variabili locali.
load_dotenv(
    PROJECT_ROOT / ".env"
)


# Segreto utilizzato per firmare i token.
#
# Deve rimanere privato e non deve
# essere pubblicato nel repository.
AUTH_JWT_SECRET = os.getenv(
    "AUTH_JWT_SECRET",
    "",
).strip()


if AUTH_JWT_SECRET == "":
    raise RuntimeError(
        "AUTH_JWT_SECRET non è configurata "
        "nel file .env."
    )


# Durata del token espressa in minuti.
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv(
            "AUTH_ACCESS_TOKEN_MINUTES",
            "720",
        )
    )

except ValueError as error:
    raise RuntimeError(
        "AUTH_ACCESS_TOKEN_MINUTES "
        "deve essere un numero intero."
    ) from error


if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError(
        "AUTH_ACCESS_TOKEN_MINUTES "
        "deve essere maggiore di zero."
    )


# Algoritmo utilizzato per firmare il JWT.
JWT_ALGORITHM = "HS256"

# Identificano chi crea il token
# e l'applicazione alla quale è destinato.
JWT_ISSUER = "fantasy-ai-api"
JWT_AUDIENCE = "fantasy-ai-web"


# Nome del cookie contenente il token JWT.
AUTH_COOKIE_NAME = (
    "fantasy_ai_access_token"
)


# In locale deve essere false perché
# localhost utilizza normalmente HTTP.
#
# In produzione deve essere true.
AUTH_COOKIE_SECURE = (
    os.getenv(
        "AUTH_COOKIE_SECURE",
        "false",
    )
    .strip()
    .casefold()
    == "true"
)


# In locale utilizziamo lax.
#
# In produzione, dato che Vercel e Render
# sono domini diversi, utilizzeremo none.
AUTH_COOKIE_SAMESITE = (
    os.getenv(
        "AUTH_COOKIE_SAMESITE",
        "lax",
    )
    .strip()
    .casefold()
)


if AUTH_COOKIE_SAMESITE not in {
    "lax",
    "strict",
    "none",
}:
    raise RuntimeError(
        "AUTH_COOKIE_SAMESITE deve essere "
        "'lax', 'strict' oppure 'none'."
    )


if (
    AUTH_COOKIE_SAMESITE == "none"
    and not AUTH_COOKIE_SECURE
):
    raise RuntimeError(
        "AUTH_COOKIE_SECURE deve essere true "
        "quando AUTH_COOKIE_SAMESITE è none."
    )


# PasswordHash.recommended utilizza
# una configurazione sicura basata su Argon2.
password_hasher = (
    PasswordHash.recommended()
)


class AuthenticationError(ValueError):
    """
    Errore generato quando un token
    non è valido oppure è scaduto.
    """


def hash_password(
    password: str,
) -> str:
    """
    Genera l'hash sicuro di una password.

    La password originale non viene
    mai salvata nel database.
    """

    if password == "":
        raise ValueError(
            "La password non può essere vuota."
        )

    return password_hasher.hash(
        password
    )


def verify_password(
    password: str,
    stored_password_hash: str,
) -> bool:
    """
    Verifica una password confrontandola
    con l'hash salvato nel database.
    """

    if (
        password == ""
        or stored_password_hash == ""
    ):
        return False

    try:
        return password_hasher.verify(
            password,
            stored_password_hash,
        )

    except Exception:
        # Un hash malformato o non riconosciuto
        # non deve autenticare l'utente.
        return False


def create_access_token(
    user_id: UUID,
) -> str:
    """
    Crea un token JWT associato
    all'identificativo dell'utente.
    """

    issued_at = datetime.now(
        timezone.utc
    )

    expires_at = (
        issued_at
        + timedelta(
            minutes=(
                ACCESS_TOKEN_EXPIRE_MINUTES
            )
        )
    )

    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": issued_at,
        "exp": expires_at,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }

    return jwt.encode(
        payload,
        AUTH_JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> UUID:
    """
    Valida il token JWT e restituisce
    l'identificativo dell'utente.
    """

    if token.strip() == "":
        raise AuthenticationError(
            "Token di autenticazione mancante."
        )

    try:
        payload = jwt.decode(
            token,
            AUTH_JWT_SECRET,
            algorithms=[
                JWT_ALGORITHM,
            ],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={
                "require": [
                    "sub",
                    "type",
                    "iat",
                    "exp",
                    "iss",
                    "aud",
                ],
            },
        )

    except InvalidTokenError as error:
        raise AuthenticationError(
            "Token non valido oppure scaduto."
        ) from error


    if payload.get("type") != "access":
        raise AuthenticationError(
            "Tipo di token non valido."
        )


    try:
        return UUID(
            str(
                payload["sub"]
            )
        )

    except (
        KeyError,
        TypeError,
        ValueError,
    ) as error:
        raise AuthenticationError(
            "Identificativo utente "
            "non valido nel token."
        ) from error