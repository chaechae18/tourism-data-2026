from translate_places import number_signature, translation_batches


def test_number_signature_allows_time_padding_but_detects_changed_numbers() -> None:
    assert number_signature("09:00~18:00") == number_signature("9:00-18:00")
    assert number_signature("09:00~18:00") != number_signature("09:00-17:00")


def test_translation_batches_respect_place_and_character_limits() -> None:
    places = [{"id": str(index), "fields": {"TEXT": "가" * 1000}} for index in range(11)]

    assert [len(batch) for batch in translation_batches(places)] == [8, 3]
