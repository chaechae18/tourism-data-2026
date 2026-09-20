from typing import Annotated

import pymysql
from fastapi import Depends, HTTPException, Request

from .mysql import get_mysql
from .routers.auth import get_current_user


def session_user_no(current: Annotated[dict, Depends(get_current_user)]) -> int:
    return current["user"]["user_no"]


def optional_session_user_no(
    request: Request,
    database: pymysql.Connection = Depends(get_mysql),
) -> int | None:
    if not request.session.get("user"):
        return None
    try:
        return get_current_user(request, database)["user"]["user_no"]
    except HTTPException as error:
        if error.status_code == 401:
            return None
        raise


UserNo = Annotated[int, Depends(session_user_no)]
ViewerNo = Annotated[int | None, Depends(optional_session_user_no)]
