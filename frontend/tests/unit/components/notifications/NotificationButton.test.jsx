import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const api = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("../../../../lib/api/notifications", () => api);

import NotificationButton from "../../../../components/notifications/NotificationButton";

const NOTIFICATION = {
  id: 7,
  type: "SPOT_LIKE",
  title: "새로운 좋아요",
  message: "첨성대 스팟에 좋아요가 눌렸어요.",
  targetType: "SPOT",
  targetId: 3,
  isRead: false,
  createdAt: "2026-08-03T00:00:00",
};

describe("NotificationButton", () => {
  beforeEach(() => {
    api.listNotifications.mockResolvedValue([NOTIFICATION]);
    api.markNotificationRead.mockResolvedValue(null);
  });

  it("shows the unread count and marks a notification as read", async () => {
    render(<NotificationButton />);

    expect(await screen.findByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "알림" }));
    fireEvent.click(await screen.findByRole("button", { name: /새로운 좋아요/ }));

    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith(7));
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
