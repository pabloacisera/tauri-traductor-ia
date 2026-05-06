# [ADDED v1.0] Modelos ORM exportados para importación centralizada
from db.database import Base, engine, SessionLocal, get_db
from db.models import User, Session, Translation, Vocabulary, UserProgress, Exercise

# [ADDED v1.0] Crear tablas al importar el módulo (idempotente)
Base.metadata.create_all(bind=engine)
