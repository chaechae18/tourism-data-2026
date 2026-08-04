import pymysql
from fastapi import APIRouter, Depends

from ..donggyeong import list_donggyeong_items
from ..models.donggyeong import DonggyeongItemResponse
from ..mysql import get_mysql


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
