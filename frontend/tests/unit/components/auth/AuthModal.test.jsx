import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import AuthModal from "../../../../components/auth/AuthModal";
import { createTranslator } from "../../../../lib/i18n";

describe("AuthModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires consent before completing sign-up", () => {
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeDisabled();
  });

  it.each([
    ["ko", "한국어"],
    ["en", "English"],
    ["ja", "日本語"],
    ["zh", "中文"],
  ])("completes sign-up with the selected language %s", async (languageCode, languageLabel) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ available: true, message: "사용 가능한 아이디입니다." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ userNo: 42, message: "회원가입 성공" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());
    const onComplete = vi.fn();
    render(<AuthModal mode="signup" onClose={vi.fn()} onComplete={onComplete} />);

    fireEvent.change(screen.getByPlaceholderText("로그인 아이디"), { target: { value: "gyeongju" } });
    fireEvent.click(screen.getByRole("button", { name: "중복확인" }));
    await screen.findByText("사용 가능한 아이디입니다.");

    fireEvent.change(screen.getByPlaceholderText("여행자 이름"), { target: { value: "경주여행자" } });
    fireEvent.change(screen.getByPlaceholderText("name@example.com"), { target: { value: "traveler@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호"), { target: { value: "password1234!" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호를 다시 입력하세요"), { target: { value: "password1234!" } });
    fireEvent.click(screen.getByRole("button", { name: languageLabel }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: createTranslator(languageCode)("auth.signupSubmit") }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ userNo: 42, message: "회원가입 성공" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8001/api/v1/auth/check-id?id=gyeongju");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8001/api/v1/auth/signup", expect.objectContaining({
      body: JSON.stringify({
        id: "gyeongju",
        nickname: "경주여행자",
        email: "traveler@example.com",
        password: "password1234!",
        country: "KR",
        languageCode,
        birthDate: null,
      }),
      method: "POST",
    }));
  });
});
