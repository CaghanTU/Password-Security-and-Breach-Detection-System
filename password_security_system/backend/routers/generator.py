from fastapi import APIRouter, HTTPException
from models.schemas import GenerateRequest, GenerateResponse
import services.generator_service as generator_service

router = APIRouter(prefix="/generator", tags=["generator"])


@router.post("/generate", response_model=GenerateResponse)
def generate(body: GenerateRequest):
    try:
        return generator_service.generate_password(
            length=body.length,
            use_upper=body.use_upper,
            use_lower=body.use_lower,
            use_digits=body.use_digits,
            use_symbols=body.use_symbols,
            min_digits=body.min_digits,
            min_symbols=body.min_symbols,
            prefix=body.prefix or "",
            suffix=body.suffix or "",
            custom_chars=body.custom_chars or "",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
