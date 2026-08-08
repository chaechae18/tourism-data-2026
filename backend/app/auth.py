import pymysql
from passlib.context import CryptContext


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


class UserAlreadyExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
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
            (%s, %s, %s, %s, %s)
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
            (%s, %s, 1)
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


def login(
    connection: pymysql.Connection,
    *,
    user_id: str,
    password: str,
):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                u.NO AS user_no,
                u.ID AS user_id,
                u.NICKNAME AS nickname,
                u.EMAIL AS email,
                u.COUNTRY AS country,
                u.STATUS AS status,
                ua.PASSWORD_HASH AS password_hash
            FROM USERS u
            INNER JOIN USER_AUTH ua
                ON ua.USER_NO = u.NO
            WHERE u.ID = %s
              AND u.STATUS = 1
              AND u.DELETED_AT IS NULL
              AND ua.PROVIDER = 1
            LIMIT 1
            """,
            (user_id,),
        )

        user = cursor.fetchone()

    # 존재하지 않는 사용자
    if not user:
        raise InvalidCredentialsError

    password_hash = user["password_hash"]

    # 비밀번호가 없는 계정
    if not password_hash:
        raise InvalidCredentialsError

    # 비밀번호 검증
    if not pwd_context.verify(password, password_hash):
        raise InvalidCredentialsError

    return {
        "userNo": user["user_no"],
        "userId": user["user_id"],
        "nickname": user["nickname"],
        "email": user["email"],
        "country": user["country"],
    }