from django.urls import path

from main import views

urlpatterns = [
    path("banners", views.BannerListView.as_view(), name="main-banners"),
    path("popup", views.PopupListView.as_view(), name="main-popup"),
    path("festivals", views.FestivalListView.as_view(), name="main-festivals"),
    path(
        "places/recommended",
        views.RecommendedPlaceListView.as_view(),
        name="main-places-recommended",
    ),
]
