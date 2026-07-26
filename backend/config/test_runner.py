"""Test runner that materialises the unmanaged team tables.

Every model in `core` mirrors a table owned by the team's MySQL DDL, so they
are all `managed = False` and Django refuses to create them in a test
database. Flipping `managed` on just for the test run lets `--run-syncdb`
build them in SQLite, which keeps the suite runnable without MySQL.
"""
from django.apps import apps
from django.test.runner import DiscoverRunner

UNMANAGED_APPS = ("core",)


class UnmanagedModelTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        self._unmanaged = [
            model
            for label in UNMANAGED_APPS
            for model in apps.get_app_config(label).get_models()
            if not model._meta.managed
        ]
        for model in self._unmanaged:
            model._meta.managed = True
        return super().setup_databases(**kwargs)

    def teardown_databases(self, old_config, **kwargs):
        super().teardown_databases(old_config, **kwargs)
        for model in getattr(self, "_unmanaged", []):
            model._meta.managed = False
