from pydantic import BaseModel

class TranslationRequest(BaseModel):
    text:str
    source_lang:str
    target_lang:str

class GrammarRequest(BaseModel):
    text:str # frase traducida