"""
Configurazione della connessione PostgreSQL
utilizzata dal backend FastAPI.
"""

# os permette di leggere le variabili d'ambiente.
import os

# Generator descrive la dependency
# che restituirà una sessione SQLAlchemy.
from collections.abc import Generator

# Path permette di trovare il file .env
# nella cartella principale del progetto.
from pathlib import Path

# Carica le variabili presenti nel file .env.
from dotenv import load_dotenv

# Componenti principali di SQLAlchemy.
from sqlalchemy import create_engine, text

from sqlalchemy.orm import (
    DeclarativeBase,
    Session,
    sessionmaker,
)


# Cartella principale fantasy-ai.
PROJECT_ROOT = Path(__file__).resolve().parents[1]


# Carichiamo esplicitamente:
#
# fantasy-ai/.env
load_dotenv(
    PROJECT_ROOT / ".env"
)


# Recuperiamo l'indirizzo del database.
DATABASE_URL = os.getenv(
    "DATABASE_URL"
)


# Impediamo l'avvio del backend
# quando manca la configurazione.
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL non è configurata. "
        "Controlla il file .env nella cartella principale."
    )


# Engine condiviso dall'applicazione.
#
# pool_pre_ping verifica che le connessioni
# recuperate dal pool siano ancora utilizzabili.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


# Factory utilizzata per creare
# una sessione per ogni richiesta.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


# Classe base dei futuri modelli SQLAlchemy.
class Base(DeclarativeBase):
    pass


def get_database_session(
) -> Generator[Session, None, None]:
    """
    Crea una sessione SQLAlchemy
    e la chiude al termine della richiesta.
    """

    with SessionLocal() as session:
        yield session


def check_database_connection() -> None:
    """
    Verifica la connessione eseguendo
    una semplice query PostgreSQL.
    """

    with engine.connect() as connection:
        connection.execute(
            text("SELECT 1")
        )