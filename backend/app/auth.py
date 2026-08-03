import pymysql
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


class UserAlreadyExistsError(Exception):
    pass


def signup(
    connection: pymysql.Connection,
    *,
    user_id: str,
    nickname: str,
    country: str,
    birth_date,
    email: str,
    password: str,
):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT NO
            FROM USERS
            WHERE ID = %s
              AND DELETED_AT IS NULL
            """,
            (user_id,),
        )

        if cursor.fetchone():
            raise UserAlreadyExistsError

        password_hash = pwd_context.hash(password)

        cursor.execute(
            """
            INSERT INTO USERS
            (
                ID,
                NICKNAME,
                COUNTRY,
                BIRTH_DATE,
                EMAIL
            )
            VALUES
            (%s,%s,%s,%s,%s)
            """,
            (
                user_id,
                nickname,
                country,
                birth_date,
                email,
            ),
        )

        user_no = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO USER_AUTH
            (
                USER_NO,
                PASSWORD_HASH,
                PROVIDER
            )
            VALUES
            (%s,%s,1)
            """,
            (
                user_no,
                password_hash,
            ),
        )

    connection.commit()

    return {
        "userNo": user_no,
        "message": "회원가입 성공",
    }