"""
Configurazione Alembic
per il database Fantasy AI.
"""

# Configurazione del logging.
from logging.config import fileConfig

# Path e sys permettono ad Alembic
# di importare correttamente il backend.
from pathlib import Path
import sys

# Oggetto principale di Alembic.
from alembic import context


# Cartella principale del progetto.
PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

project_root_text = str(
    PROJECT_ROOT
)

if project_root_text not in sys.path:
    sys.path.insert(
        0,
        project_root_text,
    )


# Importiamo la configurazione
# condivisa del database.
from backend.database import (  # noqa: E402
    Base,
    DATABASE_URL,
    engine,
)

# Importando i modelli, SQLAlchemy
# registra le tabelle dentro Base.metadata.
import backend.models  # noqa: E402, F401


# Configurazione Alembic.
config = context.config


# Configurazione del logging
# definita dentro alembic.ini.
if config.config_file_name is not None:
    fileConfig(
        config.config_file_name
    )


# Metadati confrontati con PostgreSQL
# durante l'autogenerazione.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Esegue le migrazioni senza utilizzare
    direttamente una connessione aperta.
    """

    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Esegue le migrazioni utilizzando
    l'Engine SQLAlchemy del progetto.
    """

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()