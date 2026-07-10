import { useState } from "react";
import { Bookmark, Heart, ImagePlus, MapPin, MessageCircle, Send } from "lucide-react";
import { BLOCKED_WORDS, RANKING_RESET_LABEL, SPOT_REVIEW_LIMIT } from "../../lib/app-data";
import AppButton, { IconButton } from "../ui/AppButton";
import SectionHeading from "../ui/SectionHeading";

function containsBlockedWord(value) {
  return BLOCKED_WORDS.some((word) => value.includes(word));
}

function SpotCard({ bookmarked, comments, onBookmark, onComment, onLike, rank, spot }) {
  const [topComment] = comments;
  return (
    <article className="rounded-lg border border-[#e6ddd2] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#fff1df] text-2xl">{spot.photo}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-sm font-black text-[#b8661c]">TOP {rank}</span><span className="text-xs font-bold text-[#8a7d71]">@{spot.user}</span></div>
          <h2 className="mt-1 font-bold text-[#241b16]">{spot.place}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f5044]">{spot.review}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-[#f0e8de] pt-3">
        <IconButton icon={Heart} label="추천" className="h-9 w-9 border-0 bg-transparent text-[#a8463d]" onClick={() => onLike(spot.id)} />
        <span className="mr-2 text-xs font-bold text-[#6f6256]">{spot.likes}</span>
        <IconButton icon={MessageCircle} label="댓글" className="h-9 w-9 border-0 bg-transparent" onClick={() => onComment(spot.id)} />
        <span className="mr-auto text-xs font-bold text-[#6f6256]">{comments.length || spot.comments}</span>
        <IconButton icon={Bookmark} label="북마크" className={`h-9 w-9 border-0 ${bookmarked ? "bg-[#fff1df] text-[#a45118]" : "bg-transparent"}`} onClick={() => onBookmark(spot.id)} />
      </div>
      {topComment && <p className="mt-3 rounded-lg bg-[#f8f3ed] px-3 py-2 text-xs text-[#6f6256]">{topComment}</p>}
    </article>
  );
}

export default function SpotsTab({ bookmarks, commentsBySpot, onAddComment, onAddSpot, onBookmark, onLike, spots, user }) {
  const [review, setReview] = useState("");
  const [place, setPlace] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [commentTarget, setCommentTarget] = useState(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");

  const shareSpot = () => {
    if (!place.trim() || !review.trim()) {
      setNotice("장소와 한줄평을 입력해 주세요.");
      return;
    }
    if (containsBlockedWord(review)) {
      setNotice("한줄평에 사용할 수 없는 표현이 있어요.");
      return;
    }
    onAddSpot({ place, review, photo: photoName ? "📷" : "📍", user: user.nickname });
    setPlace("");
    setReview("");
    setPhotoName("");
    setNotice("스팟을 저장했어요. 오늘 랭킹에는 반영되지 않아요.");
  };

  const submitComment = () => {
    if (!commentTarget || !comment.trim()) return;
    if (containsBlockedWord(comment)) {
      setNotice("댓글에 사용할 수 없는 표현이 있어요.");
      return;
    }
    onAddComment(commentTarget, comment);
    setComment("");
    setCommentTarget(null);
  };

  return (
    <section className="space-y-7">
      <SectionHeading eyebrow="Spot sharing" title="나만의 경주 스팟" action={<span className="text-xs font-bold text-[#7c6d61]">GPS 연결 대기</span>} />
      <div className="border-y border-[#e6ddd2] py-5">
        <div className="grid gap-3">
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-[#241b16]">장소</span><input value={place} onChange={(event) => setPlace(event.target.value)} className="h-11 w-full rounded-lg border border-[#d9cfc2] px-3 text-sm outline-none focus:border-[#b8661c]" placeholder="어디에서 발견했나요?" /></label>
          <div><span className="mb-1.5 block text-sm font-bold text-[#241b16]">사진</span><label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#d9cfc2] px-3 text-sm text-[#6f6256]"><ImagePlus size={17} /><span className="truncate">{photoName || "사진 선택"}</span><input className="sr-only" type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")} /></label></div>
        </div>
        <label className="mt-3 block"><span className="mb-1.5 block text-sm font-bold text-[#241b16]">한줄평</span><textarea value={review} maxLength={SPOT_REVIEW_LIMIT} onChange={(event) => setReview(event.target.value)} className="min-h-28 w-full resize-none rounded-lg border border-[#d9cfc2] p-3 text-sm leading-6 outline-none focus:border-[#b8661c]" placeholder="경주에서 발견한 순간을 350자 이내로 남겨 보세요." /><span className="mt-1 block text-right text-xs text-[#8a7d71]">{review.length} / {SPOT_REVIEW_LIMIT}</span></label>
        <AppButton className="mt-3" icon={Send} onClick={shareSpot}>스팟 공유</AppButton>
        {notice && <p className="mt-3 text-sm font-bold text-[#a45118]">{notice}</p>}
      </div>

      {commentTarget && (
        <div className="flex gap-2 rounded-lg bg-[#f8f3ed] p-3">
          <input value={comment} onChange={(event) => setComment(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#d9cfc2] bg-white px-3 text-sm outline-none" placeholder="댓글을 남겨보세요" />
          <AppButton size="sm" onClick={submitComment}>등록</AppButton>
        </div>
      )}

      <div>
        <SectionHeading eyebrow={RANKING_RESET_LABEL} title="오늘의 TOP 5" />
        <div className="space-y-3">
          {spots.filter((spot) => !spot.isMyPost).slice(0, 5).map((spot, index) => <SpotCard key={spot.id} bookmarked={bookmarks.includes(spot.id)} comments={commentsBySpot[spot.id] || []} onBookmark={onBookmark} onComment={setCommentTarget} onLike={onLike} rank={index + 1} spot={spot} />)}
        </div>
      </div>

      <div>
        <SectionHeading eyebrow="My posts" title="내가 쓴 게시글" />
        <div className="space-y-2">
          {spots.filter((spot) => spot.user === user.nickname).map((spot) => <div key={spot.id} className="flex items-center gap-3 rounded-lg border border-[#e6ddd2] bg-white p-3"><MapPin size={17} className="text-[#b8661c]" /><div className="min-w-0"><p className="truncate font-bold text-[#241b16]">{spot.place}</p><p className="mt-0.5 truncate text-xs text-[#7c6d61]">{spot.review}</p></div></div>)}
          {spots.every((spot) => spot.user !== user.nickname) && <p className="text-sm text-[#7c6d61]">아직 작성한 스팟이 없어요.</p>}
        </div>
      </div>
    </section>
  );
}
