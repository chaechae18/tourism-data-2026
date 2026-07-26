from django.test import SimpleTestCase

from main.i18n import DEFAULT_LANGUAGE, normalize_language


class NormalizeLanguageTests(SimpleTestCase):
    def test_supported_codes_pass_through(self):
        for code in ("ko", "en", "ja", "zh"):
            self.assertEqual(normalize_language(code), code)

    def test_regional_variants_reduce_to_the_primary_subtag(self):
        self.assertEqual(normalize_language("en-US"), "en")
        self.assertEqual(normalize_language("zh-Hans-CN"), "zh")

    def test_quality_weighted_header_uses_the_first_entry(self):
        self.assertEqual(normalize_language("ja,en;q=0.8,ko;q=0.5"), "ja")

    def test_case_and_whitespace_are_normalised(self):
        self.assertEqual(normalize_language("  EN  "), "en")

    def test_unsupported_and_empty_input_falls_back_to_korean(self):
        for raw in ("fr", "", None, "!!!", "en_US"):
            self.assertEqual(normalize_language(raw), DEFAULT_LANGUAGE)
