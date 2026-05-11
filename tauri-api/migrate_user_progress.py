from db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE user_progress RENAME TO user_progress_old"))
    conn.commit()

    conn.execute(text("""
        CREATE TABLE user_progress (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id),
            language VARCHAR(10) NOT NULL DEFAULT 'en',
            current_level VARCHAR(20) DEFAULT 'A1',
            current_exercise_id VARCHAR(36),
            consecutive_wins INTEGER DEFAULT 0,
            consecutive_fails INTEGER DEFAULT 0,
            total_exercises INTEGER DEFAULT 0,
            total_correct INTEGER DEFAULT 0,
            updated_at DATETIME,
            UNIQUE (user_id, language)
        )
    """))
    conn.commit()

    conn.execute(text("""
        INSERT INTO user_progress
        SELECT id, user_id, 'en', current_level, current_exercise_id,
               consecutive_wins, consecutive_fails, total_exercises,
               total_correct, updated_at
        FROM user_progress_old
    """))
    conn.commit()

    conn.execute(text("DROP TABLE user_progress_old"))
    conn.commit()

print("Migración completada exitosamente.")
