import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import DonggyeongCamera from "../../../../components/donggyeong/DonggyeongCamera";

const mocks = vi.hoisted(() => ({ drawTo: vi.fn() }));
vi.mock("../../../../components/donggyeong/Donggyeong3D", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  return { default: ({ ref, onReadyChange, items, transparent }) => {
    useEffect(() => { onReadyChange(true); }, [onReadyChange]);
    useImperativeHandle(ref, () => ({ drawTo: mocks.drawTo }), []);
    return <div data-testid="avatar" data-items={items.map((item) => item.id).join(",")} data-transparent={transparent} />;
  } };
});

describe("DonggyeongCamera", () => {
  let getUserMedia;
  let stop;
  let context;

  beforeEach(() => {
    stop = vi.fn();
    getUserMedia = vi.fn().mockImplementation(async ({ video }) => ({
      getTracks: () => [{ stop }],
      getVideoTracks: () => [{ getSettings: () => ({ facingMode: video.facingMode.ideal }) }],
    }));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn().mockReturnValue("blob:photo");
      static revokeObjectURL = vi.fn();
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    context = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,cGhvdG8=");
    mocks.drawTo.mockImplementation(() => {
      expect(context.drawImage).toHaveBeenCalledOnce();
      expect(context.restore).toHaveBeenCalledOnce();
      return true;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function cameraPlaying() {
    const video = screen.getByLabelText("카메라 미리보기");
    await waitFor(() => expect(video.srcObject).toBeTruthy());
    Object.defineProperties(video, { videoWidth: { value: 1920 }, videoHeight: { value: 1080 } });
    fireEvent.playing(video);
    await waitFor(() => expect(screen.getByRole("button", { name: "촬영", exact: true })).toBeEnabled());
    return video;
  }

  async function capturePhoto() {
    render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    await cameraPlaying();
    fireEvent.click(screen.getByRole("button", { name: "촬영", exact: true }));
  }

  it("composites a mirrored camera frame and the equipped character, then saves locally", async () => {
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.download).toBe("my-donggyeong.png");
      expect(this.href).toBe("blob:photo");
      expect(this.isConnected).toBe(true);
    });
    render(<DonggyeongCamera items={[{ id: "hat", slot: "hat" }, { id: "background", slot: "effect" }]} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "촬영", exact: true })).toBeDisabled();
    const video = await cameraPlaying();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: "user" } }) }));
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-items", "hat");
    expect(screen.getByTestId("avatar")).toHaveAttribute("data-transparent", "true");
    fireEvent.click(screen.getByRole("button", { name: "촬영", exact: true }));
    expect(context.drawImage).toHaveBeenCalledWith(video, expect.closeTo(-740), 0, expect.closeTo(2560), 1440);
    expect(context.translate).toHaveBeenCalledWith(1080, 0);
    expect(context.scale).toHaveBeenCalledWith(-1, 1);
    expect(mocks.drawTo).toHaveBeenCalledWith(context, 540, 576, 540, 864);
    expect(screen.getByRole("img", { name: "동경이와 함께 찍은 사진" })).toHaveAttribute("src", "data:image/png;base64,cGhvdG8=");
    expect(stop).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    expect(download).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "다시 찍기" }));
    await cameraPlaying();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("releases the old camera when switching, captures the rear camera without mirroring, and stops on unmount", async () => {
    const { unmount } = render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    await cameraPlaying();
    fireEvent.click(screen.getByRole("button", { name: "카메라 전환" }));
    await cameraPlaying();
    expect(stop).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    fireEvent.click(screen.getByRole("button", { name: "촬영", exact: true }));
    expect(context.scale).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("shares the PNG file directly from the save click and prevents duplicate requests", async () => {
    let finishSharing;
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share = vi.fn().mockReturnValue(new Promise((resolve) => { finishSharing = resolve; }));
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await capturePhoto();
    const save = screen.getByRole("button", { name: "사진 저장" });
    fireEvent.click(save);
    expect(navigator.share).toHaveBeenCalledOnce();
    const [file] = navigator.share.mock.calls[0][0].files;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("my-donggyeong.png");
    expect(file.type).toBe("image/png");
    const contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(file);
    });
    expect(contents).toBe("photo");
    expect(navigator.canShare).toHaveBeenCalledWith({ files: [file] });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "다시 찍기" })).toBeDisabled();
    fireEvent.click(save);
    expect(navigator.share).toHaveBeenCalledOnce();
    await act(async () => finishSharing());
    expect(save).toBeEnabled();
    expect(download).not.toHaveBeenCalled();
  });

  it("keeps the photo available when the share sheet is cancelled", async () => {
    navigator.canShare = vi.fn().mockReturnValue(true);
    navigator.share = vi.fn().mockRejectedValue({ name: "AbortError" });
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await capturePhoto();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "사진 저장" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "동경이와 함께 찍은 사진" })).toBeVisible();
    expect(download).not.toHaveBeenCalled();
  });

  it.each(["unsupported", "blocked"])("downloads a file when sharing is %s", async (reason) => {
    navigator.canShare = vi.fn().mockReturnValue(reason === "blocked");
    navigator.share = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await capturePhoto();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ name: "my-donggyeong.png", type: "image/png", size: 5 }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/사진을 길게 누르거나/)).toBeVisible();
  });

  it("keeps the download URL alive briefly and removes the temporary link", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await capturePhoto();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    expect(document.querySelector("a[download]")).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
  });

  it("shows download errors and clears them on a successful retry", async () => {
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementationOnce(() => { throw new Error("Download blocked"); }).mockImplementation(() => {});
    await capturePhoto();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    expect(screen.getByRole("alert")).toBeVisible();
    expect(document.querySelector("a[download]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "사진 저장" }));
    expect(download).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops an active camera when the screen is closed", async () => {
    const { unmount } = render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    await cameraPlaying();
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("releases a stream that arrives after the screen has closed", async () => {
    let resolve;
    getUserMedia.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    unmount();
    resolve({ getTracks: () => [{ stop }] });
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });

  it("explains permission denial and lets the user retry", async () => {
    getUserMedia.mockRejectedValueOnce({ name: "NotAllowedError" });
    render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("카메라 권한이 필요해요");
    expect(screen.getByRole("button", { name: "촬영", exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await cameraPlaying();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains when camera access is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    render(<DonggyeongCamera items={[]} onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTPS");
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
