import json

import requests
from django.test import SimpleTestCase

from tourapi.client import TourApiClient, TourApiError


class FakeResponse:
    def __init__(self, payload, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text or json.dumps(payload) if payload is not None else text

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class FakeSession:
    """Returns queued responses and records the params it was called with."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, params))
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def envelope(items, total_count=None, result_code="0000"):
    body = {"items": {"item": items} if items else ""}
    if total_count is not None:
        body["totalCount"] = total_count
    return {
        "response": {
            "header": {"resultCode": result_code, "resultMsg": "OK"},
            "body": body,
        }
    }


def build_client(session, **kwargs):
    return TourApiClient(
        service_key="test-key",
        base_url="https://api.example.com/KorService2",
        mobile_app="Test",
        session=session,
        max_retries=kwargs.pop("max_retries", 2),
        retry_backoff=0,
        **kwargs,
    )


class ClientConfigTests(SimpleTestCase):
    def test_missing_service_key_fails_fast_with_a_usable_message(self):
        with self.assertRaises(TourApiError) as ctx:
            TourApiClient(service_key="", base_url="https://x", mobile_app="Test")

        self.assertIn("TOURAPI_SERVICE_KEY", str(ctx.exception))

    def test_every_request_carries_the_required_common_params(self):
        session = FakeSession([FakeResponse(envelope([{"contentid": "1"}], 1))])
        client = build_client(session)

        list(client.area_based_list(content_type_id=12))

        _, params = session.calls[0]
        self.assertEqual(params["serviceKey"], "test-key")
        self.assertEqual(params["_type"], "json")
        self.assertEqual(params["MobileOS"], "ETC")
        self.assertEqual(params["MobileApp"], "Test")
        self.assertEqual(params["contentTypeId"], 12)


class ResponseHandlingTests(SimpleTestCase):
    def test_non_ok_result_code_raises_with_the_api_message(self):
        session = FakeSession([FakeResponse(envelope([], result_code="30"))])

        with self.assertRaises(TourApiError) as ctx:
            list(build_client(session).area_based_list())

        self.assertIn("30", str(ctx.exception))

    def test_xml_error_body_is_reported_rather_than_crashing(self):
        session = FakeSession(
            [FakeResponse(None, text="<OpenAPI_ServiceResponse>...</OpenAPI_ServiceResponse>")]
        )

        with self.assertRaises(TourApiError) as ctx:
            list(build_client(session).area_based_list())

        self.assertIn("인증키", str(ctx.exception))

    def test_empty_items_string_yields_no_rows(self):
        session = FakeSession([FakeResponse(envelope([], 0))])

        self.assertEqual(list(build_client(session).area_based_list()), [])

    def test_single_hit_returned_as_an_object_is_wrapped_in_a_list(self):
        payload = {
            "response": {
                "header": {"resultCode": "0000", "resultMsg": "OK"},
                "body": {"items": {"item": {"contentid": "1"}}, "totalCount": 1},
            }
        }
        session = FakeSession([FakeResponse(payload)])

        self.assertEqual(list(build_client(session).area_based_list()), [{"contentid": "1"}])


class PagingTests(SimpleTestCase):
    def test_walks_pages_until_total_count_is_reached(self):
        page_one = envelope([{"contentid": str(i)} for i in range(100)], total_count=150)
        page_two = envelope([{"contentid": str(i)} for i in range(100, 150)], total_count=150)
        session = FakeSession([FakeResponse(page_one), FakeResponse(page_two)])

        items = list(build_client(session).area_based_list())

        self.assertEqual(len(items), 150)
        self.assertEqual(session.calls[0][1]["pageNo"], 1)
        self.assertEqual(session.calls[1][1]["pageNo"], 2)

    def test_stops_after_a_single_page_when_everything_fits(self):
        session = FakeSession([FakeResponse(envelope([{"contentid": "1"}], total_count=1))])

        list(build_client(session).area_based_list())

        self.assertEqual(len(session.calls), 1)


class RetryTests(SimpleTestCase):
    def test_network_error_is_retried_then_succeeds(self):
        session = FakeSession(
            [
                requests.ConnectionError("boom"),
                FakeResponse(envelope([{"contentid": "1"}], 1)),
            ]
        )

        items = list(build_client(session).area_based_list())

        self.assertEqual(len(items), 1)
        self.assertEqual(len(session.calls), 2)

    def test_server_error_is_retried(self):
        session = FakeSession(
            [FakeResponse(None, status_code=503), FakeResponse(envelope([{"contentid": "1"}], 1))]
        )

        self.assertEqual(len(list(build_client(session).area_based_list())), 1)

    def test_client_error_is_not_retried(self):
        session = FakeSession([FakeResponse(None, status_code=400)])

        with self.assertRaises(TourApiError):
            list(build_client(session).area_based_list())

        self.assertEqual(len(session.calls), 1)

    def test_401_says_the_key_is_unrecognised(self):
        session = FakeSession([FakeResponse(None, status_code=401, text="Unauthorized")])

        with self.assertRaises(TourApiError) as ctx:
            list(build_client(session).area_based_list())

        message = str(ctx.exception)
        self.assertIn("401", message)
        self.assertIn("TOURAPI_SERVICE_KEY", message)

    def test_403_points_at_the_approval_status_not_the_key(self):
        """The two are easy to confuse, and the fix is completely different."""
        session = FakeSession([FakeResponse(None, status_code=403, text="Forbidden")])

        with self.assertRaises(TourApiError) as ctx:
            list(build_client(session).area_based_list())

        message = str(ctx.exception)
        self.assertIn("403", message)
        self.assertIn("활용신청", message)

    def test_response_body_is_carried_into_the_error(self):
        session = FakeSession(
            [FakeResponse(None, status_code=400, text="  SERVICE ERROR\n  detail  ")]
        )

        with self.assertRaises(TourApiError) as ctx:
            list(build_client(session).area_based_list())

        self.assertIn("SERVICE ERROR detail", str(ctx.exception))

    def test_giving_up_after_the_retry_budget_raises(self):
        session = FakeSession([requests.Timeout("t1"), requests.Timeout("t2")])

        with self.assertRaises(TourApiError):
            list(build_client(session, max_retries=2).area_based_list())

        self.assertEqual(len(session.calls), 2)


class FestivalSearchTests(SimpleTestCase):
    def test_search_festival_uses_ldong_codes(self):
        session = FakeSession([FakeResponse(envelope([{"contentid": "100"}], 1))])
        client = build_client(session)

        items = list(client.search_festival(event_start_date="20260726"))

        self.assertEqual(len(items), 1)
        _, params = session.calls[0]
        self.assertEqual(params["eventStartDate"], "20260726")
        self.assertEqual(params["lDongRegnCd"], "47")
        self.assertEqual(params["lDongSignguCd"], "130")

