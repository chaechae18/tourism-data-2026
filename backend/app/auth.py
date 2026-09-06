import pymysql
from passlib.context import CryptContext
import os
import httpx


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
    language_code: str,
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
                EMAIL,
                LANGUAGE_CODE
            )
            VALUES
            (%s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                nickname,
                country,
                birth_date,
                email,
                language_code,
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
        "userId": user_id,
        "nickname": nickname,
        "email": email,
        "country": country,
        "languageCode": language_code,
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
                u.PROFILE_IMAGE AS profile_image,
                u.LANGUAGE_CODE AS language_code,
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
        "profile_image": user["profile_image"],
        "language_code": user["language_code"]
    }
    
async def get_naver_user(code: str, state: str):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    redirect_uri = os.getenv("NAVER_REDIRECT_URI")

    if not client_id:
        raise RuntimeError("NAVER_CLIENT_ID가 설정되지 않았습니다.")

    if not client_secret:
        raise RuntimeError("NAVER_CLIENT_SECRET이 설정되지 않았습니다.")

    if not redirect_uri:
        raise RuntimeError("NAVER_REDIRECT_URI가 설정되지 않았습니다.")

    async with httpx.AsyncClient() as client:

        # 1. authorization code -> access token
        token_response = await client.post(
            "https://nid.naver.com/oauth2.0/token",
            params={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "state": state,
            },
        )

        token_response.raise_for_status()

        token_data = token_response.json()

        if "access_token" not in token_data:
            raise RuntimeError(
                f"네이버 access token 발급 실패: {token_data}"
            )

        access_token = token_data["access_token"]

        # 2. access token -> 사용자 정보
        user_response = await client.get(
            "https://openapi.naver.com/v1/nid/me",
            headers={
                "Authorization": f"Bearer {access_token}",
            },
        )

        user_response.raise_for_status()

        user_data = user_response.json()

        if user_data.get("resultcode") != "00":
            raise RuntimeError(
                f"네이버 사용자 정보 조회 실패: {user_data}"
            )

        profile = user_data["response"]

        return {
            "provider_id": profile["id"],
            "nickname": profile.get("nickname"),
            "email": profile.get("email"),
            "profile_image": profile.get("profile_image"),
            "name": profile.get("name"),
        }
        

def login_with_naver(
    connection: pymysql.Connection,
    *,
    naver_user: dict,
):
    provider_id = naver_user["provider_id"]
    nickname = naver_user.get("nickname") or naver_user.get("name") or "네이버 사용자"
    email = naver_user.get("email")
    profile_image = naver_user.get("profile_image")

    with connection.cursor() as cursor:

        # =====================================================
        # 1. 이미 네이버로 가입한 사용자인지 확인
        # =====================================================
        cursor.execute(
            """
            SELECT
                u.NO AS user_no,
                u.ID AS user_id,
                u.NICKNAME AS nickname,
                u.EMAIL AS email,
                u.PROFILE_IMAGE AS profile_image,
                u.LANGUAGE_CODE AS language_code,
                u.COUNTRY AS country,
                u.STATUS AS status
            FROM USERS u
            INNER JOIN USER_AUTH ua
                ON ua.USER_NO = u.NO
            WHERE ua.PROVIDER = 4
              AND ua.PROVIDER_ID = %s
              AND u.STATUS = 1
              AND u.DELETED_AT IS NULL
            LIMIT 1
            """,
            (provider_id,),
        )

        user = cursor.fetchone()

        # =====================================================
        # 2. 기존 네이버 회원이면 로그인
        # =====================================================
        if user:
            return {
                "userNo": user["user_no"],
                "userId": user["user_id"],
                "nickname": user["nickname"],
                "email": user["email"],
                "country": user["country"],
                "profile_image": user["profile_image"],
                "language_code": user["language_code"],
            }

        # =====================================================
        # 3. 신규 네이버 회원이면 USERS 생성
        # =====================================================

        # USERS.ID는 NOT NULL + UNIQUE이므로
        # 네이버 사용자 ID를 기반으로 내부 ID 생성
        user_id = f"naver_{provider_id}"

        # 이메일이 없을 경우를 대비한 기본값
        if not email:
            email = f"{user_id}@naver.local"

        cursor.execute(
            """
            INSERT INTO USERS
            (
                ID,
                NICKNAME,
                COUNTRY,
                BIRTH_DATE,
                EMAIL,
                PROFILE_IMAGE,
                LANGUAGE_CODE
            )
            VALUES
            (%s, %s, %s, NULL, %s, %s, %s)
            """,
            (
                user_id,
                nickname,
                "KR",
                email,
                profile_image,
                "ko",
            ),
        )

        user_no = cursor.lastrowid

        # =====================================================
        # 4. USER_AUTH에 네이버 인증 정보 저장
        # =====================================================
        cursor.execute(
            """
            INSERT INTO USER_AUTH
            (
                USER_NO,
                PASSWORD_HASH,
                PROVIDER,
                PROVIDER_ID,
                EMAIL_VERIFIED
            )
            VALUES
            (%s, NULL, 4, %s, %s)
            """,
            (
                user_no,
                provider_id,
                1 if naver_user.get("email") else 0,
            ),
        )

        connection.commit()

        return {
            "userNo": user_no,
            "userId": user_id,
            "nickname": nickname,
            "email": email,
            "country": "KR",
            "profile_image": profile_image,
            "language_code": "ko",
        }

# =========================================================
# 카카오 사용자 정보 가져오기
# =========================================================
async def get_kakao_user(code: str, state: str | None = None):
    client_id = os.getenv("KAKAO_CLIENT_ID")
    client_secret = os.getenv("KAKAO_CLIENT_SECRET")
    redirect_uri = os.getenv("KAKAO_REDIRECT_URI")

    if not client_id:
        raise RuntimeError(
            "KAKAO_CLIENT_ID가 설정되지 않았습니다."
        )

    if not client_secret:
        raise RuntimeError(
            "KAKAO_CLIENT_SECRET이 설정되지 않았습니다."
        )

    if not redirect_uri:
        raise RuntimeError(
            "KAKAO_REDIRECT_URI가 설정되지 않았습니다."
        )

    async with httpx.AsyncClient() as client:

        # =====================================================
        # 1. authorization code -> access token
        # =====================================================
        token_params = {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        }

        # state를 사용한다면 같이 전달
        if state:
            token_params["state"] = state

        token_response = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data=token_params,
        )

        token_response.raise_for_status()

        token_data = token_response.json()

        if "access_token" not in token_data:
            raise RuntimeError(
                f"카카오 access token 발급 실패: {token_data}"
            )

        access_token = token_data["access_token"]

        # =====================================================
        # 2. access token -> 카카오 사용자 정보
        # =====================================================
        user_response = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={
                "Authorization": f"Bearer {access_token}",
            },
        )

        user_response.raise_for_status()

        user_data = user_response.json()

        kakao_account = user_data.get(
            "kakao_account",
            {},
        )

        profile = kakao_account.get(
            "profile",
            {},
        )

        return {
            "provider_id": str(user_data["id"]),
            "nickname": profile.get("nickname"),
            "email": kakao_account.get("email"),
            "profile_image": profile.get("profile_image_url"),
            "name": kakao_account.get("name"),
        }


# =========================================================
# 카카오 회원 조회 / 신규 회원 생성
# =========================================================
def login_with_kakao(
    connection: pymysql.Connection,
    *,
    kakao_user: dict,
):
    provider_id = kakao_user["provider_id"]

    nickname = (
        kakao_user.get("nickname")
        or kakao_user.get("name")
        or "카카오 사용자"
    )

    email = kakao_user.get("email")
    profile_image = kakao_user.get("profile_image")

    with connection.cursor() as cursor:

        # =====================================================
        # 1. 이미 카카오로 가입한 사용자인지 확인
        # =====================================================
        cursor.execute(
            """
            SELECT
                u.NO AS user_no,
                u.ID AS user_id,
                u.NICKNAME AS nickname,
                u.EMAIL AS email,
                u.PROFILE_IMAGE AS profile_image,
                u.LANGUAGE_CODE AS language_code,
                u.COUNTRY AS country,
                u.STATUS AS status
            FROM USERS u
            INNER JOIN USER_AUTH ua
                ON ua.USER_NO = u.NO
            WHERE ua.PROVIDER = 3
              AND ua.PROVIDER_ID = %s
              AND u.STATUS = 1
              AND u.DELETED_AT IS NULL
            LIMIT 1
            """,
            (provider_id,),
        )

        user = cursor.fetchone()

        # =====================================================
        # 2. 기존 카카오 회원이면 로그인
        # =====================================================
        if user:
            return {
                "userNo": user["user_no"],
                "userId": user["user_id"],
                "nickname": user["nickname"],
                "email": user["email"],
                "country": user["country"],
                "profile_image": user["profile_image"],
                "language_code": user["language_code"],
            }

        # =====================================================
        # 3. 신규 카카오 회원 생성
        # =====================================================

        # USERS.ID는 NOT NULL + UNIQUE이므로
        # 카카오 사용자 ID 기반으로 내부 ID 생성
        user_id = f"kakao_{provider_id}"

        # 이메일이 제공되지 않는 경우 대비
        if not email:
            email = f"{user_id}@kakao.local"

        cursor.execute(
            """
            INSERT INTO USERS
            (
                ID,
                NICKNAME,
                COUNTRY,
                BIRTH_DATE,
                EMAIL,
                PROFILE_IMAGE,
                LANGUAGE_CODE
            )
            VALUES
            (%s, %s, %s, NULL, %s, %s, %s)
            """,
            (
                user_id,
                nickname,
                "KR",
                email,
                profile_image,
                "ko",
            ),
        )

        user_no = cursor.lastrowid

        # =====================================================
        # 4. USER_AUTH에 카카오 인증 정보 저장
        # =====================================================
        cursor.execute(
            """
            INSERT INTO USER_AUTH
            (
                USER_NO,
                PASSWORD_HASH,
                PROVIDER,
                PROVIDER_ID,
                EMAIL_VERIFIED
            )
            VALUES
            (%s, NULL, 3, %s, %s)
            """,
            (
                user_no,
                provider_id,
                1 if kakao_user.get("email") else 0,
            ),
        )

        connection.commit()

        return {
            "userNo": user_no,
            "userId": user_id,
            "nickname": nickname,
            "email": email,
            "country": "KR",
            "profile_image": profile_image,
            "language_code": "ko",
        }

# =========================================================
# 구글 사용자 정보 가져오기
# =========================================================
async def get_google_user(
    code: str,
    state: str | None = None,
):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not client_id:
        raise RuntimeError(
            "GOOGLE_CLIENT_ID가 설정되지 않았습니다."
        )

    if not client_secret:
        raise RuntimeError(
            "GOOGLE_CLIENT_SECRET이 설정되지 않았습니다."
        )

    if not redirect_uri:
        raise RuntimeError(
            "GOOGLE_REDIRECT_URI가 설정되지 않았습니다."
        )

    async with httpx.AsyncClient() as client:

        # =====================================================
        # 1. authorization code -> access token
        # =====================================================
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        token_response.raise_for_status()

        token_data = token_response.json()

        if "access_token" not in token_data:
            raise RuntimeError(
                f"구글 access token 발급 실패: {token_data}"
            )

        access_token = token_data["access_token"]

        # =====================================================
        # 2. access token -> 구글 사용자 정보
        # =====================================================
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={
                "Authorization": f"Bearer {access_token}",
            },
        )

        user_response.raise_for_status()

        user_data = user_response.json()

        provider_id = user_data.get("sub")

        if not provider_id:
            raise RuntimeError(
                f"구글 사용자 ID가 없습니다: {user_data}"
            )

        return {
            "provider_id": str(provider_id),
            "nickname": (
                user_data.get("name")
                or user_data.get("given_name")
                or "구글 사용자"
            ),
            "email": user_data.get("email"),
            "profile_image": user_data.get("picture"),
            "name": user_data.get("name"),
            "email_verified": user_data.get(
                "email_verified",
                False,
            ),
        }
        
# =========================================================
# 구글 회원 조회 / 신규 회원 생성
# =========================================================
def login_with_google(
    connection: pymysql.Connection,
    *,
    google_user: dict,
):
    provider_id = google_user["provider_id"]

    nickname = (
        google_user.get("nickname")
        or google_user.get("name")
        or "구글 사용자"
    )

    email = google_user.get("email")
    profile_image = google_user.get("profile_image")

    # 현재 프로젝트 기준
    # 일반 = 1
    # 카카오 = 3
    # 네이버 = 4
    # 구글 = 5
    provider = 5

    with connection.cursor() as cursor:

        # =====================================================
        # 1. 이미 구글로 가입한 사용자인지 확인
        # =====================================================
        cursor.execute(
            """
            SELECT
                u.NO AS user_no,
                u.ID AS user_id,
                u.NICKNAME AS nickname,
                u.EMAIL AS email,
                u.PROFILE_IMAGE AS profile_image,
                u.LANGUAGE_CODE AS language_code,
                u.COUNTRY AS country,
                u.STATUS AS status
            FROM USERS u
            INNER JOIN USER_AUTH ua
                ON ua.USER_NO = u.NO
            WHERE ua.PROVIDER = %s
              AND ua.PROVIDER_ID = %s
              AND u.STATUS = 1
              AND u.DELETED_AT IS NULL
            LIMIT 1
            """,
            (
                provider,
                provider_id,
            ),
        )

        user = cursor.fetchone()

        # =====================================================
        # 2. 기존 구글 회원이면 로그인
        # =====================================================
        if user:
            return {
                "userNo": user["user_no"],
                "userId": user["user_id"],
                "nickname": user["nickname"],
                "email": user["email"],
                "country": user["country"],
                "profile_image": user["profile_image"],
                "language_code": user["language_code"],
            }

        # =====================================================
        # 3. 신규 구글 회원 생성
        # =====================================================

        # USERS.ID는 NOT NULL + UNIQUE
        user_id = f"google_{provider_id}"

        # 이메일이 없는 경우 대비
        if not email:
            email = f"{user_id}@google.local"

        cursor.execute(
            """
            INSERT INTO USERS
            (
                ID,
                NICKNAME,
                COUNTRY,
                BIRTH_DATE,
                EMAIL,
                PROFILE_IMAGE,
                LANGUAGE_CODE
            )
            VALUES
            (%s, %s, %s, NULL, %s, %s, %s)
            """,
            (
                user_id,
                nickname,
                "KR",
                email,
                profile_image,
                "ko",
            ),
        )

        user_no = cursor.lastrowid

        # =====================================================
        # 4. USER_AUTH에 구글 인증 정보 저장
        # =====================================================
        cursor.execute(
            """
            INSERT INTO USER_AUTH
            (
                USER_NO,
                PASSWORD_HASH,
                PROVIDER,
                PROVIDER_ID,
                EMAIL_VERIFIED
            )
            VALUES
            (%s, NULL, %s, %s, %s)
            """,
            (
                user_no,
                provider,
                provider_id,
                1 if google_user.get("email_verified") else 0,
            ),
        )

        connection.commit()

        return {
            "userNo": user_no,
            "userId": user_id,
            "nickname": nickname,
            "email": email,
            "country": "KR",
            "profile_image": profile_image,
            "language_code": "ko",
        }
