from pydantic import Field

from .common import CamelModel


class ImageUploadResponse(CamelModel):
    url: str
    filename: str
    content_type: str = Field(alias="contentType")
    size: int
