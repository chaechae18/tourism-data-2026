import pymysql

from .models.users import LanguageCode, UserPreferencesResponse


class UserNotFoundError(Exception):
    pass


def get_user_preferences(
    connection: pymysql.Connection,
    *,
    user_no: int,
) -> UserPreferencesResponse:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT LANGUAGE_CODE FROM USERS WHERE NO = %s AND DELETED_AT IS NULL",
            (user_no,),
        )
        row = cursor.fetchone()
    if not row:
        raise UserNotFoundError
    return UserPreferencesResponse(language=row["LANGUAGE_CODE"])


def update_user_language(
    connection: pymysql.Connection,
    *,
    user_no: int,
    language: LanguageCode,
) -> UserPreferencesResponse:
    get_user_preferences(connection, user_no=user_no)
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE USERS SET LANGUAGE_CODE = %s WHERE NO = %s",
            (language, user_no),
        )
    return UserPreferencesResponse(language=language)
