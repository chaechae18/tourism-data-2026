"use client";

import { Bell, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  listNotifications,
  markNotificationRead,
} from "../../lib/api/notifications";
import { IconButton } from "../ui/AppButton";


export default function NotificationButton({ refreshKey = 0 }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setNotifications(await listNotifications());
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const toggle = async () => {
    if (!open) await load();
    setOpen((current) => !current);
  };

  const read = async (notification) => {
    if (notification.isRead) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isRead: true } : item
      )));
    } catch (readError) {
      setError(readError.message);
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="relative">
      <div className="relative">
        <IconButton icon={Bell} label="알림" onClick={toggle} />
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a8463d] px-1 text-[10px] font-bold text-white">
            {Math.min(unreadCount, 99)}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e2e4e0] bg-white shadow-xl">
          <div className="border-b border-[#e2e4e0] px-4 py-3">
            <p className="font-bold text-[#343235]">알림</p>
            <p className="mt-0.5 text-xs text-[#747579]">좋아요와 퀘스트 소식을 확인하세요.</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => read(notification)}
                className={`flex w-full items-start gap-3 border-b border-[#f0e8de] px-4 py-3 text-left last:border-0 ${notification.isRead ? "bg-white" : "bg-[#fffaf4]"}`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${notification.isRead ? "bg-[#eef0ee] text-[#747579]" : "bg-[#fff1df] text-[#a45118]"}`}>
                  {notification.isRead ? <Check size={14} /> : <Bell size={14} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#343235]">{notification.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#747579]">{notification.message}</span>
                </span>
              </button>
            ))}
            {!error && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[#747579]">새 알림이 없어요.</p>
            )}
            {error && <p className="px-4 py-4 text-sm font-semibold text-[#a8463d]">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
