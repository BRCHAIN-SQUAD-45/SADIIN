from fastapi.responses import JSONResponse

from app.schemas.core import generate_trace_id


def api_error(status_code: int, code: str, message: str, path: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": {"path": path},
                "request_id": generate_trace_id(),
            }
        },
    )


def source_unavailable(path: str, message: str) -> JSONResponse:
    return api_error(501, "SOURCE_UNAVAILABLE", message, path)