import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Heart,
  ImagePlus,
  LoaderCircle,
  List,
  LocateFixed,
  MapPin,
  MessageCircle,
  Search,
  Send,
  SquarePen,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  createSpot,
  createSpotComment,
  deleteSpot,
  listMySpots,
  listPublicSpots,
  listSpotRanking,
  listSpotComments,
  searchNearbyPlaces,
  searchPlaces,
  setSpotReaction,
  uploadSpotImage,
} from "../../lib/api/spots";
import { BLOCKED_WORDS, SPOT_REVIEW_LIMIT } from "../../lib/app-data";
import { translateError } from "../../lib/i18n";
import { useI18n } from "../i18n/LanguageProvider";
import AppButton, { IconButton } from "../ui/AppButton";
import AppModal from "../ui/AppModal";
import SectionHeading from "../ui/SectionHeading";

const MODERATION_KEY = {
  0: "pending",
  1: "approved",
  2: "rejected",
};

const INITIAL_ERRORS = {
  ranking: "",
  list: "",
  search: "",
  my: "",
};

// 백엔드의 10초 임시 승인 작업이 끝난 뒤 조회하도록 약간의 여유를 둔다.
const TEMPORARY_APPROVAL_REFRESH_MS = 10_500;

function getErrorMessage(error, t) {
  return translateError(error, t);
}

function containsBlockedWord(value) {
  return BLOCKED_WORDS.some((word) => value.includes(word));
}

function inferPlaceType(place) {
  const foodCodes = ["FD6", "CE7"];
  if (foodCodes.includes(place.categoryGroupCode)) return "FOOD";
  return /음식|카페|식당/.test(place.categoryName) ? "FOOD" : "TOUR";
}

function formatDistance(distance) {
  if (distance === null || distance === undefined) return null;
  if (distance < 1_000) return `${distance}m`;
  return `${(distance / 1_000).toFixed(1)}km`;
}

function SpotPhoto({
  alt = "",
  className = "h-16 w-16 shrink-0 rounded-lg object-cover",
  iconSize = 24,
  spot,
}) {
  if (spot.photoUrl) {
    return (
      <img
        alt={alt}
        className={className}
        src={spot.photoUrl}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-brand-soft text-[#b8661c] ${className}`}>
      <MapPin size={iconSize} />
    </div>
  );
}

function SpotCard({
  comment,
  comments,
  commentsOpen,
  onCommentChange,
  onCommentSubmit,
  onDelete,
  onOpenComments,
  onReaction,
  spot,
  submittingComment,
  className = "rounded-lg bg-white p-4",
  hidePhoto = false,
}) {
  const { t } = useI18n();

  return (
    <article className={className}>
      <div className="flex items-start gap-3">
        {!hidePhoto && <SpotPhoto alt={t("spots.photoAlt", { name: spot.place.name })} spot={spot} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#8a7d71]">
              @{spot.authorNickname}
            </span>
          </div>
          <h2 className="mt-1 font-bold text-[#241b16]">{spot.place.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f5044]">{spot.caption}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-[#f0e8de] pt-3">
        <IconButton
          icon={Heart}
          label={t(spot.isLiked ? "spots.unlike" : "spots.like")}
          className={`h-9 w-9 border-0 ${spot.isLiked ? "bg-[#fff0ed] text-[#a8463d]" : "bg-transparent"}`}
          onClick={() => onReaction(spot, "like")}
        />
        <span className="mr-2 text-xs font-bold text-[#6f6256]">{spot.likeCount}</span>
        <IconButton
          icon={MessageCircle}
          label={t("spots.comment")}
          className={`h-9 w-9 border-0 ${commentsOpen ? "bg-[#f1f4f2]" : "bg-transparent"}`}
          onClick={() => onOpenComments(spot.id)}
        />
        <span className="mr-auto text-xs font-bold text-[#6f6256]">{spot.commentCount}</span>
        <IconButton
          icon={Bookmark}
          label={t(spot.isBookmarked ? "spots.unbookmark" : "spots.bookmark")}
          className={`h-9 w-9 border-0 ${spot.isBookmarked ? "bg-brand-soft text-brand-ink" : "bg-transparent"}`}
          onClick={() => onReaction(spot, "bookmark")}
        />
        {spot.isOwner && (
          <IconButton
            icon={Trash2}
            label={t("spots.deleteMine")}
            className="h-9 w-9 border-0 bg-transparent text-[#a8463d]"
            onClick={() => onDelete(spot.id)}
          />
        )}
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-2 rounded-lg bg-[#f8f3ed] p-3">
          {comments.map((item) => (
            <div key={item.id} className="rounded-lg bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#6f6256]">
                  @{item.authorNickname}
                </span>
                {item.moderationStatus === 0 && (
                  <span className="text-[10px] font-bold text-brand-ink">{t("spots.pending")}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#5f5044]">{item.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-[#7c6d61]">{t("spots.firstComment")}</p>
          )}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#d9cfc2] bg-white px-3 text-sm outline-none"
              placeholder={t("spots.commentPlaceholder")}
            />
            <AppButton
              size="sm"
              disabled={submittingComment || !comment.trim()}
              onClick={() => onCommentSubmit(spot.id)}
            >
              {t("spots.submitComment")}
            </AppButton>
          </div>
        </div>
      )}
    </article>
  );
}

function SpotGridTile({ onOpen, spot }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      aria-label={t("spots.openPost", { name: spot.place.name })}
      className="group relative aspect-square min-w-0 overflow-hidden rounded-xl bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8661c]"
      onClick={() => onOpen(spot.id)}
    >
      <SpotPhoto
        alt={t("spots.previewAlt", { name: spot.place.name })}
        className="h-full w-full rounded-none object-cover transition-transform duration-200 group-hover:scale-105"
        iconSize={28}
        spot={spot}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6 text-[10px] font-bold text-white">
        <Heart size={12} fill={spot.isLiked ? "currentColor" : "none"} />
        {spot.likeCount}
      </span>
    </button>
  );
}

function SpotDetailModal({
  comment,
  comments,
  commentsOpen,
  onClose,
  onCommentChange,
  onCommentSubmit,
  onDelete,
  onOpenComments,
  onReaction,
  spot,
  submittingComment,
}) {
  const { t } = useI18n();

  return (
    <AppModal open={Boolean(spot)} onClose={onClose} title={t("spots.postTitle")}>
      {spot && (
        <>
          <div className="-mx-6">
            <SpotPhoto
              alt={t("spots.postPhotoAlt", { name: spot.place.name })}
              className="aspect-square w-full rounded-none object-cover"
              iconSize={52}
              spot={spot}
            />
          </div>
          <SpotCard
            spot={spot}
            comment={comment}
            comments={comments}
            commentsOpen={commentsOpen}
            onCommentChange={onCommentChange}
            onCommentSubmit={onCommentSubmit}
            onDelete={onDelete}
            onOpenComments={onOpenComments}
            onReaction={onReaction}
            submittingComment={submittingComment}
            className="bg-white pb-0 pt-4"
            hidePhoto
          />
        </>
      )}
    </AppModal>
  );
}

function DummySpotGridCard({ index }) {
  const { t } = useI18n();

  return (
    <article
      aria-label={t("spots.spotPlaceholder", { index })}
      data-testid="spot-placeholder"
      className="aspect-square min-w-0 overflow-hidden rounded-xl bg-white p-2 shadow-[0_3px_12px_rgba(52,50,53,0.06)]"
    >
      <div className="h-full w-full bg-[#f1eee9]" />
    </article>
  );
}

function DummyRankingCard({ rank }) {
  const { t } = useI18n();

  return (
    <article
      aria-label={t("spots.rankingPlaceholder", { rank })}
      data-testid="ranking-placeholder"
      className="flex min-h-28 items-center gap-3 rounded-xl bg-white p-3 shadow-[0_3px_12px_rgba(52,50,53,0.06)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
        {rank}
      </span>
      <div className="h-20 w-20 shrink-0 rounded-lg bg-[#f1eee9]" />
      <div className="min-w-0 flex-1">
        <div className="h-3 w-2/3 rounded-full bg-[#ece8e2]" />
        <div className="mt-2 h-2.5 w-full rounded-full bg-[#f2efeb]" />
        <div className="mt-1.5 h-2.5 w-4/5 rounded-full bg-[#f2efeb]" />
      </div>
    </article>
  );
}

export default function SpotsTab() {
  const { language, t } = useI18n();
  const [activeView, setActiveView] = useState("ranking");
  const [listSort, setListSort] = useState("likes");
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [review, setReview] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [publicSpots, setPublicSpots] = useState([]);
  const [rankingSpots, setRankingSpots] = useState([]);
  const [mySpots, setMySpots] = useState([]);
  const [commentsBySpot, setCommentsBySpot] = useState({});
  const [commentTarget, setCommentTarget] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [detailSpotId, setDetailSpotId] = useState(null);
  const approvalRefreshTimer = useRef(null);

  useEffect(() => () => {
    if (approvalRefreshTimer.current !== null) {
      window.clearTimeout(approvalRefreshTimer.current);
    }
  }, []);

  useEffect(() => {
    setNotice("");
  }, [language]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      listSpotRanking(),
      listPublicSpots(listSort),
      listMySpots(),
    ]).then(([rankingResult, listResult, myResult]) => {
      if (!active) return;
      if (rankingResult.status === "fulfilled") {
        setRankingSpots(rankingResult.value);
      }
      if (listResult.status === "fulfilled") {
        setPublicSpots(listResult.value);
      }
      if (myResult.status === "fulfilled") {
        setMySpots(myResult.value);
      }
      setErrors((current) => ({
        ...current,
        ranking: rankingResult.status === "rejected" ? getErrorMessage(rankingResult.reason, t) : "",
        list: listResult.status === "rejected" ? getErrorMessage(listResult.reason, t) : "",
        my: myResult.status === "rejected" ? getErrorMessage(myResult.reason, t) : "",
      }));
    });
    return () => { active = false; };
  }, [listSort, refreshVersion, t]);

  useEffect(() => {
    const keyword = query.trim();
    if (selectedPlace?.name === keyword || !keyword) {
      setSearchResults([]);
      setSearching(false);
      setErrors((current) => ({ ...current, search: "" }));
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setErrors((current) => ({ ...current, search: "" }));
      try {
        const result = await searchPlaces(keyword, { signal: controller.signal });
        setSearchResults(result.places);
      } catch (error) {
        if (error.name !== "AbortError") {
          setErrors((current) => ({ ...current, search: getErrorMessage(error, t) }));
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedPlace, t]);

  const selectPlace = (place) => {
    setSelectedPlace(place);
    setQuery(place.name);
    setSearchResults([]);
    setNearbyResults([]);
  };

  const loadNearbyPlaces = () => {
    if (!navigator.geolocation) {
      setErrors((current) => ({
        ...current,
        search: t("spots.geolocationUnsupported"),
      }));
      return;
    }

    setLocating(true);
    setNotice("");
    setErrors((current) => ({ ...current, search: "" }));
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await searchNearbyPlaces({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          setSelectedPlace(null);
          setQuery("");
          setSearchResults([]);
          setNearbyResults(result.places);
          setNotice(
            result.places.length > 0
              ? t("spots.nearbyLoaded")
              : t("spots.nearbyEmpty"),
          );
        } catch (error) {
          setErrors((current) => ({ ...current, search: getErrorMessage(error, t) }));
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        const messages = {
          1: t("spots.permissionDenied"),
          2: t("spots.positionUnavailable"),
          3: t("spots.timeout"),
        };
        setErrors((current) => ({
          ...current,
          search: messages[error.code] || t("spots.locationFailed"),
        }));
        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 8_000,
      },
    );
  };

  const shareSpot = async () => {
    if (!selectedPlace || !review.trim()) {
      setNotice(t("spots.selectPlace"));
      return;
    }
    if (containsBlockedWord(review)) {
      setNotice(t("spots.blockedReview"));
      return;
    }

    setSubmitting(true);
    try {
      const upload = photoFile ? await uploadSpotImage(photoFile) : null;
      const created = await createSpot({
        place: selectedPlace,
        placeType: inferPlaceType(selectedPlace),
        caption: review.trim(),
        photoUrl: upload?.url || null,
      });
      setMySpots((current) => [created, ...current]);
      setSelectedPlace(null);
      setQuery("");
      setNearbyResults([]);
      setReview("");
      setPhotoFile(null);
      setNotice(t("spots.created"));
      if (approvalRefreshTimer.current !== null) {
        window.clearTimeout(approvalRefreshTimer.current);
      }
      approvalRefreshTimer.current = window.setTimeout(() => {
        approvalRefreshTimer.current = null;
        setRefreshVersion((current) => current + 1);
      }, TEMPORARY_APPROVAL_REFRESH_MS);
    } catch (error) {
      setNotice(getErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  const removeSpot = async (spotId) => {
    if (!window.confirm(t("spots.deleteConfirm"))) return;
    try {
      await deleteSpot(spotId);
      setMySpots((current) => current.filter((spot) => spot.id !== spotId));
      setPublicSpots((current) => current.filter((spot) => spot.id !== spotId));
      setRankingSpots((current) => current.filter((spot) => spot.id !== spotId));
      setDetailSpotId((current) => (current === spotId ? null : current));
      setNotice(t("spots.deleted"));
    } catch (error) {
      const target = activeView === "ranking" ? "ranking" : activeView === "list" ? "list" : "my";
      setErrors((current) => ({ ...current, [target]: getErrorMessage(error, t) }));
    }
  };

  const toggleReaction = async (spot, type) => {
    const stateKey = type === "like" ? "isLiked" : "isBookmarked";
    try {
      const result = await setSpotReaction(spot.id, type, !spot[stateKey]);
      setPublicSpots((current) => current.map((item) => (
        item.id === spot.id
          ? {
              ...item,
              [stateKey]: result.active,
              likeCount: result.likeCount,
            }
          : item
      )));
      setRankingSpots((current) => current.map((item) => (
        item.id === spot.id
          ? { ...item, [stateKey]: result.active, likeCount: result.likeCount }
          : item
      )));
    } catch (error) {
      const target = activeView === "ranking" ? "ranking" : "list";
      setErrors((current) => ({ ...current, [target]: getErrorMessage(error, t) }));
    }
  };

  const openComments = async (spotId) => {
    if (commentTarget === spotId) {
      setCommentTarget(null);
      return;
    }
    setCommentTarget(spotId);
    setComment("");
    try {
      const comments = await listSpotComments(spotId);
      setCommentsBySpot((current) => ({ ...current, [spotId]: comments }));
    } catch (error) {
      const target = activeView === "ranking" ? "ranking" : "list";
      setErrors((current) => ({ ...current, [target]: getErrorMessage(error, t) }));
    }
  };

  const submitComment = async (spotId) => {
    if (!comment.trim()) return;
    if (containsBlockedWord(comment)) {
      setNotice(t("spots.blockedComment"));
      return;
    }
    setSubmittingComment(true);
    try {
      const created = await createSpotComment(spotId, comment.trim());
      setCommentsBySpot((current) => ({
        ...current,
        [spotId]: [...(current[spotId] || []), created],
      }));
      setComment("");
      setNotice(t("spots.commentCreated"));
    } catch (error) {
      const target = activeView === "ranking" ? "ranking" : "list";
      setErrors((current) => ({ ...current, [target]: getErrorMessage(error, t) }));
    } finally {
      setSubmittingComment(false);
    }
  };

  const placeResults = searchResults.length > 0
    ? searchResults
    : nearbyResults;
  const detailSpot = publicSpots.find((spot) => spot.id === detailSpotId) || null;

  const closeSpotDetail = () => {
    setDetailSpotId(null);
    setCommentTarget(null);
    setComment("");
  };

  return (
    <section className={activeView === "ranking" ? "flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1 overflow-y-auto pb-6"}>
      <h1 className="mb-3 shrink-0 text-lg font-semibold text-[#343235]">{t("spots.title")}</h1>
      <nav className="sticky top-0 z-20 -mx-4 shrink-0 bg-[#f7f7f5]/95 px-4 py-1 backdrop-blur" aria-label={t("spots.navLabel")}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "ranking", label: t("spots.ranking"), icon: Trophy },
            { id: "list", label: t("spots.spots"), icon: List },
            { id: "create", label: t("spots.create"), icon: SquarePen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveView(tab.id)}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors ${active ? "bg-[#343235] text-white" : "bg-white text-[#6f6256]"}`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div data-testid="ranking-section" className={`mt-5 ${activeView === "ranking" ? "flex min-h-0 flex-1 flex-col" : "hidden"}`}>
        {errors.ranking && (
          <p className="mb-3 shrink-0 text-sm font-bold text-brand-ink">{errors.ranking}</p>
        )}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-2 pb-4 pt-2">
          {rankingSpots.length > 0 ? rankingSpots.map((spot) => (
            <div key={spot.id} className="relative">
              <span className="absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-brand px-2 text-sm font-black text-white shadow-md">
                {spot.rank}
              </span>
              <SpotCard
                spot={spot}
                comment={commentTarget === spot.id ? comment : ""}
                comments={commentsBySpot[spot.id] || []}
                commentsOpen={commentTarget === spot.id}
                onCommentChange={setComment}
                onCommentSubmit={submitComment}
                onDelete={removeSpot}
                onOpenComments={openComments}
                onReaction={toggleReaction}
                submittingComment={submittingComment}
              />
            </div>
          )) : Array.from({ length: 5 }, (_, index) => (
            <DummyRankingCard key={index} rank={index + 1} />
          ))}
        </div>
      </div>

      <div className={`mt-5 ${activeView === "create" ? "" : "hidden"}`}>
        <div>
          <label htmlFor="spot-place-search" className="mb-1.5 block text-sm font-bold text-[#241b16]">
            {t("spots.searchLabel")}
          </label>
          {errors.search && (
            <p className="mb-2 text-sm font-bold text-brand-ink">{errors.search}</p>
          )}
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3 text-[#8a7d71]" />
            <input
              id="spot-place-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedPlace(null);
                setNearbyResults([]);
              }}
              className="h-11 w-full rounded-lg border-0 bg-white pl-10 pr-9 text-sm outline-none focus:bg-brand-soft"
              placeholder={t("spots.locationPlaceholder")}
            />
            {searching && (
              <LoaderCircle size={17} className="absolute right-3 top-3 animate-spin text-[#b8661c]" />
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <AppButton
            icon={LocateFixed}
            className="!border-0"
            size="sm"
            variant="outline"
            disabled={locating}
            onClick={loadNearbyPlaces}
          >
            {t(locating ? "spots.locating" : "spots.nearby")}
          </AppButton>
          <span className="text-xs text-[#7c6d61]">{t("spots.radius")}</span>
        </div>

        {nearbyResults.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#7c6d61]">
            <span>{t("spots.nearby")}</span>
            <span>{t("spots.nearest")}</span>
          </div>
        )}

        {placeResults.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-white shadow-lg">
            {placeResults.map((place) => (
              <button
                key={`${place.provider}-${place.id}`}
                type="button"
                onClick={() => selectPlace(place)}
                className="flex w-full items-start gap-3 px-3 py-3 text-left"
              >
                <MapPin size={17} className="mt-0.5 shrink-0 text-[#b8661c]" />
                <span className="min-w-0">
                  <span className="block font-bold text-[#241b16]">{place.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#7c6d61]">
                    {place.roadAddress || place.address}
                  </span>
                </span>
                {formatDistance(place.distance) && (
                  <span className="ml-auto shrink-0 text-right text-[10px] font-bold text-brand-ink">
                    {formatDistance(place.distance)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {selectedPlace && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-soft p-3">
            <MapPin size={17} className="mt-0.5 shrink-0 text-[#b8661c]" />
            <div className="min-w-0">
              <p className="font-bold text-[#241b16]">{selectedPlace.name}</p>
              <p className="mt-0.5 truncate text-xs text-[#7c6d61]">
                {selectedPlace.roadAddress || selectedPlace.address}
              </p>
            </div>
          </div>
        )}

        <div className="mt-3">
          <span className="mb-1.5 block text-sm font-bold text-[#241b16]">{t("spots.photo")}</span>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 text-sm text-[#6f6256]">
            <ImagePlus size={17} />
            <span className="truncate">{photoFile?.name || t("spots.choosePhoto")}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="mt-3">
          <label htmlFor="spot-review" className="mb-1.5 block text-sm font-bold text-[#241b16]">{t("spots.review")}</label>
          <div className="overflow-hidden rounded-lg bg-white focus-within:bg-brand-soft">
            <textarea
              id="spot-review"
              aria-describedby="spot-review-count"
              value={review}
              maxLength={SPOT_REVIEW_LIMIT}
              onChange={(event) => setReview(event.target.value)}
              className="block min-h-28 w-full resize-none border-0 bg-transparent p-3 text-sm leading-6 outline-none"
              placeholder={t("spots.reviewPlaceholder")}
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <span id="spot-review-count" className="text-xs text-[#8a7d71]">
                {review.length}/{SPOT_REVIEW_LIMIT}
              </span>
              <AppButton
                size="sm"
                icon={Send}
                disabled={submitting}
                onClick={shareSpot}
              >
                {t(submitting ? "spots.submitting" : "spots.share")}
              </AppButton>
            </div>
          </div>
        </div>
        {notice && <p className="mt-3 text-sm font-bold text-brand-ink">{notice}</p>}
      </div>

      <div data-testid="spot-section" className={`mt-5 ${activeView === "list" ? "" : "hidden"}`}>
        <SectionHeading
          className={errors.list ? "mb-2" : "mb-4"}
          title={t("spots.publicTitle")}
          action={(
            <label className="flex items-center gap-2 text-xs font-bold text-[#6f6256]">
              {t("spots.sort")}
              <select
                aria-label={t("spots.sortLabel")}
                value={listSort}
                onChange={(event) => setListSort(event.target.value)}
                className="h-9 rounded-lg border border-[#d9cfc2] bg-white px-2 outline-none"
              >
                <option value="likes">{t("spots.sortLikes")}</option>
                <option value="newest">{t("spots.sortNewest")}</option>
              </select>
            </label>
          )}
        />
        {errors.list && (
          <p className="mb-3 text-sm font-bold text-brand-ink">{errors.list}</p>
        )}
        {publicSpots.length > 0 ? (
          <div
            data-testid="spot-gallery"
            className="grid max-h-[560px] grid-cols-3 gap-1 overflow-y-auto"
          >
            {publicSpots.map((spot) => (
              <SpotGridTile
                key={spot.id}
                spot={spot}
                onOpen={setDetailSpotId}
              />
            ))}
          </div>
        ) : (
          <div data-testid="spot-placeholder-grid" className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <DummySpotGridCard key={index} index={index + 1} />
            ))}
          </div>
        )}
      </div>

      <div className={`mt-7 ${activeView === "create" ? "" : "hidden"}`}>
        <SectionHeading className={errors.my ? "mb-2" : "mb-4"} title={t("spots.mineTitle")} />
        {errors.my && <p className="mb-3 text-sm font-bold text-brand-ink">{errors.my}</p>}
        <div className="space-y-2">
          {mySpots.map((spot) => (
            <div key={spot.id} className="flex items-center gap-3 rounded-lg border border-[#e6ddd2] bg-white p-3">
              <MapPin size={17} className="shrink-0 text-[#b8661c]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-[#241b16]">{spot.place.name}</p>
                  <span className="shrink-0 text-[10px] font-bold text-brand-ink">
                    {t(`spots.${MODERATION_KEY[spot.moderationStatus]}`)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#7c6d61]">{spot.caption}</p>
              </div>
              <IconButton
                icon={Trash2}
                label={t("spots.deleteMine")}
                className="h-9 w-9 shrink-0 border-0 bg-transparent text-[#a8463d]"
                onClick={() => removeSpot(spot.id)}
              />
            </div>
          ))}
          {mySpots.length === 0 && (
            <p className="text-sm text-[#7c6d61]">{t("spots.noMine")}</p>
          )}
        </div>
      </div>

      <SpotDetailModal
        spot={detailSpot}
        comment={detailSpot && commentTarget === detailSpot.id ? comment : ""}
        comments={detailSpot ? commentsBySpot[detailSpot.id] || [] : []}
        commentsOpen={Boolean(detailSpot && commentTarget === detailSpot.id)}
        onClose={closeSpotDetail}
        onCommentChange={setComment}
        onCommentSubmit={submitComment}
        onDelete={removeSpot}
        onOpenComments={openComments}
        onReaction={toggleReaction}
        submittingComment={submittingComment}
      />
    </section>
  );
}
