import { useCallback, useEffect, useState } from "react";
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
import { BLOCKED_WORDS, RANKING_RESET_LABEL, SPOT_REVIEW_LIMIT } from "../../lib/app-data";
import AppButton, { IconButton } from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

const MODERATION_LABEL = {
  0: "검수 대기",
  1: "승인",
  2: "반려",
};

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

function SpotPhoto({ spot }) {
  if (spot.photoUrl) {
    return (
      <img
        alt={`${spot.place.name} 사진`}
        className="h-16 w-16 shrink-0 rounded-lg object-cover"
        src={spot.photoUrl}
      />
    );
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#fff1df] text-[#b8661c]">
      <MapPin size={24} />
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
}) {
  return (
    <article className="rounded-lg border border-[#e6ddd2] bg-white p-4">
      <div className="flex items-start gap-3">
        <SpotPhoto spot={spot} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#8a7d71]">
              @{spot.authorNickname}
            </span>
            <span className="rounded-full bg-[#f2eee8] px-2 py-0.5 text-[10px] font-bold text-[#7c6d61]">
              {spot.place.provider}
            </span>
          </div>
          <h2 className="mt-1 font-bold text-[#241b16]">{spot.place.name}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f5044]">{spot.caption}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-[#f0e8de] pt-3">
        <IconButton
          icon={Heart}
          label={spot.isLiked ? "좋아요 취소" : "좋아요"}
          className={`h-9 w-9 border-0 ${spot.isLiked ? "bg-[#fff0ed] text-[#a8463d]" : "bg-transparent"}`}
          onClick={() => onReaction(spot, "like")}
        />
        <span className="mr-2 text-xs font-bold text-[#6f6256]">{spot.likeCount}</span>
        <IconButton
          icon={MessageCircle}
          label="댓글"
          className={`h-9 w-9 border-0 ${commentsOpen ? "bg-[#f1f4f2]" : "bg-transparent"}`}
          onClick={() => onOpenComments(spot.id)}
        />
        <span className="mr-auto text-xs font-bold text-[#6f6256]">{spot.commentCount}</span>
        <IconButton
          icon={Bookmark}
          label={spot.isBookmarked ? "북마크 취소" : "북마크"}
          className={`h-9 w-9 border-0 ${spot.isBookmarked ? "bg-[#fff1df] text-[#a45118]" : "bg-transparent"}`}
          onClick={() => onReaction(spot, "bookmark")}
        />
        {spot.isOwner && (
          <IconButton
            icon={Trash2}
            label="내 스팟 삭제"
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
                  <span className="text-[10px] font-bold text-[#a45118]">검수 대기</span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#5f5044]">{item.content}</p>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-[#7c6d61]">첫 댓글을 남겨보세요.</p>
          )}
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#d9cfc2] bg-white px-3 text-sm outline-none"
              placeholder="댓글을 남겨보세요"
            />
            <AppButton
              size="sm"
              disabled={submittingComment || !comment.trim()}
              onClick={() => onCommentSubmit(spot.id)}
            >
              등록
            </AppButton>
          </div>
        </div>
      )}
    </article>
  );
}

export default function SpotsTab() {
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

  const loadSpots = useCallback(async () => {
    try {
      const [rankingItems, publicItems, myItems] = await Promise.all([
        listSpotRanking(),
        listPublicSpots(listSort),
        listMySpots(),
      ]);
      setRankingSpots(rankingItems);
      setPublicSpots(publicItems);
      setMySpots(myItems);
    } catch (error) {
      setNotice(error.message);
    }
  }, [listSort]);

  useEffect(() => {
    loadSpots();
  }, [loadSpots]);

  useEffect(() => {
    const keyword = query.trim();
    if (selectedPlace?.name === keyword || keyword.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchPlaces(keyword, { signal: controller.signal });
        setSearchResults(result.places);
      } catch (error) {
        if (error.name !== "AbortError") setNotice(error.message);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedPlace]);

  const selectPlace = (place) => {
    setSelectedPlace(place);
    setQuery(place.name);
    setSearchResults([]);
    setNearbyResults([]);
  };

  const loadNearbyPlaces = () => {
    if (!navigator.geolocation) {
      setNotice("이 브라우저에서는 현재 위치를 사용할 수 없어요.");
      return;
    }

    setLocating(true);
    setNotice("");
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
              ? "현재 위치에서 가까운 장소를 불러왔어요."
              : "현재 위치 주변에서 등록할 장소를 찾지 못했어요.",
          );
        } catch (error) {
          setNotice(error.message);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        const messages = {
          1: "위치 권한이 필요해요. 권한을 허용하거나 장소를 직접 검색해 주세요.",
          2: "현재 위치를 확인할 수 없어요. 장소를 직접 검색해 주세요.",
          3: "현재 위치 확인 시간이 초과됐어요. 다시 시도해 주세요.",
        };
        setNotice(messages[error.code] || "현재 위치를 확인하지 못했어요.");
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
      setNotice("검색 결과에서 장소를 선택하고 한줄평을 입력해 주세요.");
      return;
    }
    if (containsBlockedWord(review)) {
      setNotice("한줄평에 사용할 수 없는 표현이 있어요.");
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
      setNotice("스팟을 등록했어요. 승인 후 공개 목록에 표시됩니다.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeSpot = async (spotId) => {
    if (!window.confirm("이 스팟을 삭제할까요?")) return;
    try {
      await deleteSpot(spotId);
      setMySpots((current) => current.filter((spot) => spot.id !== spotId));
      setPublicSpots((current) => current.filter((spot) => spot.id !== spotId));
      setNotice("스팟을 삭제했어요.");
    } catch (error) {
      setNotice(error.message);
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
      setNotice(error.message);
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
      setNotice(error.message);
    }
  };

  const submitComment = async (spotId) => {
    if (!comment.trim()) return;
    if (containsBlockedWord(comment)) {
      setNotice("댓글에 사용할 수 없는 표현이 있어요.");
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
      setNotice("댓글을 등록했어요. 승인 후 다른 사용자에게 표시됩니다.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const placeResults = searchResults.length > 0
    ? searchResults
    : nearbyResults;

  return (
    <section className="space-y-7">
      <SectionHeading eyebrow="Spot sharing" title="나만의 경주 스팟" />
      <nav className="sticky top-0 z-20 -mx-4 border-y border-[#e6ddd2] bg-[#f7f7f5]/95 px-4 py-2 backdrop-blur" aria-label="스팟 상단 메뉴">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "ranking", label: "랭킹", icon: Trophy },
            { id: "list", label: "목록", icon: List },
            { id: "create", label: "나의 스팟 등록", icon: SquarePen },
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
      {notice && <p className="text-sm font-bold text-[#a45118]">{notice}</p>}

      <div className={activeView === "ranking" ? "" : "hidden"}>
        <SectionHeading
          eyebrow="Daily ranking"
          title="오늘의 스팟 랭킹"
          action={<span className="text-xs font-bold text-[#8a7d71]">{RANKING_RESET_LABEL}</span>}
        />
        <div className="space-y-3">
          {rankingSpots.map((spot) => (
            <div key={spot.id} className="relative">
              <span className="absolute -left-2 -top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-[#bd8c31] px-2 text-sm font-black text-white shadow-md">
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
          ))}
          {rankingSpots.length === 0 && (
            <p className="text-sm text-[#7c6d61]">오늘 랭킹에 표시할 스팟이 없어요.</p>
          )}
        </div>
      </div>

      <div className={`border-y border-[#e6ddd2] py-5 ${activeView === "create" ? "" : "hidden"}`}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[#241b16]">장소 검색</span>
          <div className="relative">
            <Search size={17} className="absolute left-3 top-3 text-[#8a7d71]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedPlace(null);
                setNearbyResults([]);
              }}
              className="h-11 w-full rounded-lg border border-[#d9cfc2] pl-10 pr-9 text-sm outline-none focus:border-[#b8661c]"
              placeholder="어디에서 발견했나요?"
            />
            {searching && (
              <LoaderCircle size={17} className="absolute right-3 top-3 animate-spin text-[#b8661c]" />
            )}
          </div>
        </label>

        <div className="mt-2 flex items-center gap-3">
          <AppButton
            icon={LocateFixed}
            size="sm"
            variant="outline"
            disabled={locating}
            onClick={loadNearbyPlaces}
          >
            {locating ? "주변 장소 찾는 중..." : "내 주변 장소"}
          </AppButton>
          <span className="text-xs text-[#7c6d61]">현재 위치 기준 2km</span>
        </div>

        {nearbyResults.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#7c6d61]">
            <span>내 주변 장소</span>
            <span>가까운 순</span>
          </div>
        )}

        {placeResults.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#e6ddd2] bg-white shadow-lg">
            {placeResults.map((place) => (
              <button
                key={`${place.provider}-${place.id}`}
                type="button"
                onClick={() => selectPlace(place)}
                className="flex w-full items-start gap-3 border-b border-[#f0e8de] px-3 py-3 text-left last:border-0 hover:bg-[#fffaf4]"
              >
                <MapPin size={17} className="mt-0.5 shrink-0 text-[#b8661c]" />
                <span className="min-w-0">
                  <span className="block font-bold text-[#241b16]">{place.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-[#7c6d61]">
                    {place.roadAddress || place.address}
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-right text-[10px] font-bold text-[#8a7d71]">
                  {formatDistance(place.distance) && (
                    <span className="block text-[#b8661c]">
                      {formatDistance(place.distance)}
                    </span>
                  )}
                  {place.provider}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedPlace && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#fff1df] p-3">
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
          <span className="mb-1.5 block text-sm font-bold text-[#241b16]">사진</span>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#d9cfc2] px-3 text-sm text-[#6f6256]">
            <ImagePlus size={17} />
            <span className="truncate">{photoFile?.name || "사진 선택"}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold text-[#241b16]">한줄평</span>
          <textarea
            value={review}
            maxLength={SPOT_REVIEW_LIMIT}
            onChange={(event) => setReview(event.target.value)}
            className="min-h-28 w-full resize-none rounded-lg border border-[#d9cfc2] p-3 text-sm leading-6 outline-none focus:border-[#b8661c]"
            placeholder="경주에서 발견한 순간을 350자 이내로 남겨 보세요."
          />
          <span className="mt-1 block text-right text-xs text-[#8a7d71]">
            {review.length} / {SPOT_REVIEW_LIMIT}
          </span>
        </label>
        <AppButton
          className="mt-3"
          icon={Send}
          disabled={submitting}
          onClick={shareSpot}
        >
          {submitting ? "등록 중..." : "스팟 공유"}
        </AppButton>
      </div>

      <div className={activeView === "list" ? "" : "hidden"}>
        <SectionHeading
          eyebrow="Approved spots"
          title="공개 스팟"
          action={(
            <label className="flex items-center gap-2 text-xs font-bold text-[#6f6256]">
              정렬
              <select
                aria-label="스팟 목록 정렬"
                value={listSort}
                onChange={(event) => setListSort(event.target.value)}
                className="h-9 rounded-lg border border-[#d9cfc2] bg-white px-2 outline-none"
              >
                <option value="likes">좋아요순</option>
                <option value="newest">신규순</option>
              </select>
            </label>
          )}
        />
        <div className="space-y-3">
          {publicSpots.map((spot) => (
            <SpotCard
              key={spot.id}
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
          ))}
          {publicSpots.length === 0 && (
            <p className="text-sm text-[#7c6d61]">아직 승인된 스팟이 없어요.</p>
          )}
        </div>
      </div>

      <div className={activeView === "create" ? "" : "hidden"}>
        <SectionHeading eyebrow="My posts" title="내가 쓴 게시글" />
        <div className="space-y-2">
          {mySpots.map((spot) => (
            <div key={spot.id} className="flex items-center gap-3 rounded-lg border border-[#e6ddd2] bg-white p-3">
              <MapPin size={17} className="shrink-0 text-[#b8661c]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-[#241b16]">{spot.place.name}</p>
                  <span className="shrink-0 text-[10px] font-bold text-[#a45118]">
                    {MODERATION_LABEL[spot.moderationStatus]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#7c6d61]">{spot.caption}</p>
              </div>
              <IconButton
                icon={Trash2}
                label="내 스팟 삭제"
                className="h-9 w-9 shrink-0 border-0 bg-transparent text-[#a8463d]"
                onClick={() => removeSpot(spot.id)}
              />
            </div>
          ))}
          {mySpots.length === 0 && (
            <p className="text-sm text-[#7c6d61]">아직 작성한 스팟이 없어요.</p>
          )}
        </div>
      </div>
    </section>
  );
}
