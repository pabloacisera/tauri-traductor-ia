# [ADDED v1.0] Conexión SQLAlchemy con SQLite para ContextIA
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# [ADDED v1.0] SQLite local en el directorio del backend
SQLALCHEMY_DATABASE_URL = "sqlite:///./contextia.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# [ADDED v1.0] Dependency injection para FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
