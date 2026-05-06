# [ADDED v1.0] Middleware exportado para importación centralizada
from middleware.auth_middleware import (
    get_current_user,
    require_auth,
    create_jwt_token,
    hash_password,
    verify_password,
    JWT_SECRET,
    JWT_EXPIRATION_DAYS
)
