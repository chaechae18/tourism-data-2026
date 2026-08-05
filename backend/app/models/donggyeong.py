from enum import StrEnum
from pathlib import PurePosixPath
from typing import Literal

from pydantic import Field

from .common import CamelModel


class ModelFileExtension(StrEnum):
    GLB = ".glb"
    GLTF = ".gltf"

    @classmethod
    def from_path(cls, path: str | None) -> "ModelFileExtension | None":
        if not path:
            return None
        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        suffix = PurePosixPath(clean_path).suffix.lower()
        try:
            return cls(suffix)
        except ValueError:
            return None


class DonggyeongItemResponse(CamelModel):
    id: int
    name: str
    slot: Literal["hat", "accessory", "clothes", "hand"]
    image_url: str | None = Field(alias="imageUrl")
    model_url: str | None = Field(alias="modelUrl")
    model_extension: ModelFileExtension | None = Field(alias="modelExtension")
    description: str | None
