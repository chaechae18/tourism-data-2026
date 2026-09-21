"""Request options and response checks shared by text AI features."""
import logging

import httpx


logger = logging.getLogger(__name__)


def chat_options(model: str, *, effort: str, max_completion_tokens: int) -> dict:
    options = {"max_completion_tokens": max_completion_tokens}
    if model.startswith("gpt-5.6"):
        options["reasoning_effort"] = effort
    else:
        options["temperature"] = 0
    return options


def read_content(response: httpx.Response) -> str:
    choice = response.json()["choices"][0]
    if choice.get("finish_reason") not in (None, "stop"):
        raise ValueError("AI response did not finish normally")
    message = choice["message"]
    content = message.get("content")
    if message.get("refusal") or not isinstance(content, str) or not content.strip():
        raise ValueError("AI response has no usable content")
    return content


def log_failure(feature: str, model: str, error: Exception) -> None:
    # Do not log prompts, images, credentials, or the raw error message.
    if isinstance(error, httpx.HTTPStatusError):
        response = error.response
        try:
            detail = response.json().get("error", {})
            if not isinstance(detail, dict):
                detail = {}
        except (ValueError, AttributeError):
            detail = {}
        logger.warning(
            "%s model=%s status=%s code=%s param=%s request_id=%s",
            feature, model, response.status_code, detail.get("code"),
            detail.get("param"), response.headers.get("x-request-id"),
        )
    else:
        logger.warning("%s model=%s failure=%s", feature, model, type(error).__name__)
