import pymysql
from fastapi import APIRouter, Depends, HTTPException

from ..donggyeong import list_donggyeong_items
from ..models.donggyeong import DonggyeongItemResponse, InventoryResponse, OutfitRequest
from ..mysql import get_mysql
from ..personas import PERSONAS
from ..quest_rewards import inventory, save_outfit
from .journey import UserNo


router = APIRouter(prefix="/api/v1/donggyeong", tags=["donggyeong"])


@router.get(
    "/items",
    response_model=list[DonggyeongItemResponse],
    response_model_by_alias=True,
)
def get_donggyeong_items(
    database: pymysql.Connection = Depends(get_mysql),
) -> list[DonggyeongItemResponse]:
    return list_donggyeong_items(database)


@router.get("/inventory", response_model=InventoryResponse)
def get_inventory(user_no: UserNo, persona: str, database=Depends(get_mysql)):
    if persona not in PERSONAS:
        raise HTTPException(status_code=404, detail="역할을 찾을 수 없습니다.")
    return inventory(database, user_no, persona)


@router.put("/outfit", response_model=InventoryResponse)
def put_outfit(user_no: UserNo, persona: str, request: OutfitRequest, database=Depends(get_mysql)):
    if persona not in PERSONAS:
        raise HTTPException(status_code=404, detail="역할을 찾을 수 없습니다.")
    try:
        return save_outfit(database, user_no=user_no, persona=persona, outfit=request.outfit)
    except ValueError as error:
        raise HTTPException(status_code=400, detail={"code": "ITEM_NOT_OWNED", "message": str(error)}) from error
