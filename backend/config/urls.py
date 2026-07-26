from django.urls import include, path

urlpatterns = [
    path("api/main/", include("main.urls")),
]
