# [ADDED] Fake payment adapter - Simula procesamiento de tarjetas
# Para reemplazo real: copiar esta estructura en stripe_adapter.py y reimplementar process()
import os
from datetime import datetime
from payments.base import PaymentGateway, PaymentResult


class FakePaymentAdapter(PaymentGateway):
    def __init__(self):
        self._cards = self._load_cards()

    def _load_cards(self):
        cards = []
        data_path = os.path.join(os.path.dirname(__file__), os.pardir, "fake_payments", "data.txt")
        try:
            with open(data_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("|")
                    if len(parts) == 9:
                        cards.append({
                            "email": parts[1],
                            "password": parts[2],
                            "brand": parts[3],
                            "number": parts[4],
                            "mm": parts[5],
                            "yy": parts[6],
                            "cvv": parts[7],
                            "result": parts[8],
                        })
        except Exception:
            pass
        return cards

    def _detect_brand(self, card_number: str) -> str:
        if card_number.startswith("4"):
            return "Visa"
        if card_number.startswith("5"):
            return "Mastercard"
        if card_number.startswith("3"):
            return "Amex"
        return "Unknown"

    def _validate_expiry(self, mm: str, yy: str) -> tuple:
        try:
            m = int(mm)
            y = int(yy)
            if m < 1 or m > 12:
                return False, "Mes de vencimiento inválido"
            now = datetime.utcnow()
            expiry_date = datetime(year=2000 + y, month=m, day=1)
            if expiry_date < datetime(year=now.year, month=now.month, day=1):
                return False, "La tarjeta está vencida"
            return True, None
        except ValueError:
            return False, "Fecha de vencimiento inválida"

    def process(self, card_number: str, expiry_mm: str, expiry_yy: str, cvv: str, plan_type: str, user_id: str) -> PaymentResult:
        clean_card = card_number.replace(" ", "").replace("-", "")

        if len(clean_card) != 16 or not clean_card.isdigit():
            return PaymentResult(False, "invalid_card", "El número de tarjeta debe tener 16 dígitos")

        valid, msg = self._validate_expiry(expiry_mm, expiry_yy)
        if not valid:
            return PaymentResult(False, "expired_card", msg)

        if len(cvv) != 3 or not cvv.isdigit():
            return PaymentResult(False, "invalid_cvv", "El código de seguridad debe tener 3 dígitos")

        brand = self._detect_brand(clean_card)
        last4 = clean_card[-4:]

        for card in self._cards:
            if card["number"] == clean_card and card["cvv"] == cvv:
                result = card["result"]
                error_messages = {
                    "decline": "La tarjeta fue rechazada por el banco emisor",
                    "insufficient_funds": "Fondos insuficientes en la tarjeta",
                    "expired_card": "La tarjeta está vencida",
                    "invalid_cvv": "Código de seguridad incorrecto",
                }
                if result != "success":
                    return PaymentResult(
                        False, result,
                        error_messages.get(result, "Error en el procesamiento de la tarjeta"),
                        brand, last4
                    )
                return PaymentResult(True, card_brand=brand, card_last4=last4)

        return PaymentResult(False, "invalid_card", "Tarjeta no encontrada en el sistema de prueba. Usá los datos de test en data.txt")
