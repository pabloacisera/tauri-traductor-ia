# [ADDED] Payment adapter base - Define el contrato común para todos los gateways
# Para reemplazar con Stripe/MercadoPago real, solo hay que implementar este adapter
from abc import ABC, abstractmethod
from typing import Optional


class PaymentResult:
    def __init__(self, success: bool, error_code: Optional[str] = None, message: Optional[str] = None, card_brand: Optional[str] = None, card_last4: Optional[str] = None):
        self.success = success
        self.error_code = error_code
        self.message = message
        self.card_brand = card_brand
        self.card_last4 = card_last4


class PaymentGateway(ABC):
    @abstractmethod
    def process(self, card_number: str, expiry_mm: str, expiry_yy: str, cvv: str, plan_type: str, user_id: str) -> PaymentResult:
        """Procesa un pago. Retorna PaymentResult."""
        pass
