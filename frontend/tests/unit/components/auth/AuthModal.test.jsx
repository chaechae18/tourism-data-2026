import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import AuthModal from "../../../../components/auth/AuthModal";

describe("AuthModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires consent before completing sign-up", () => {
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeDisabled();
  });

  it("passes the sign-up response to the completion handler", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ userNo: 42, message: "회원가입 성공" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onComplete = vi.fn();
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={onComplete} />);

    fireEvent.change(screen.getByPlaceholderText("로그인 아이디"), { target: { value: "gyeongju" } });
    fireEvent.change(screen.getByPlaceholderText("여행자 이름"), { target: { value: "경주여행자" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "traveler@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호"), { target: { value: "password123" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호를 다시 입력하세요"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ userNo: 42, message: "회원가입 성공" });
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8001/api/v1/auth/signup", expect.objectContaining({
      body: JSON.stringify({
        id: "gyeongju",
        nickname: "경주여행자",
        email: "traveler@example.com",
        password: "password123",
        country: "KR",
        birthDate: null,
      }),
      method: "POST",
    }));
  });
});
