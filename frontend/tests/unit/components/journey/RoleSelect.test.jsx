import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import RoleSelect, { ROLES } from "../../../../components/journey/RoleSelect";

test("한 번에 한 캐릭터를 보여주고 좌우로 여섯 역할을 순환한다", () => {
  const onSelect = vi.fn();
  render(<RoleSelect onClose={() => {}} onSelect={onSelect} open selectedKey="king" />);

  for (const role of ROLES) {
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: role.name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: role.name })).toBeInTheDocument();
    expect(screen.getByText(role.description)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 역할" }));
  }
  expect(screen.getByRole("heading", { name: "왕" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "이전 역할" }));
  expect(screen.getByRole("heading", { name: "상인" })).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByText("코스 준비됨")).not.toBeInTheDocument();
});

test("역할을 고르면 그 역할을 알려준다", () => {
  const onSelect = vi.fn();
  render(<RoleSelect onClose={() => {}} onSelect={onSelect} open selectedKey="king" />);

  fireEvent.click(screen.getByRole("button", { name: "다음 역할" }));
  fireEvent.click(screen.getByRole("button", { name: "학자 선택" }));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "scholar" }));
});

test("다시 열면 둘러보던 역할 대신 현재 선택된 역할로 시작한다", () => {
  const props = { onClose: vi.fn(), onSelect: vi.fn(), selectedKey: "hwarang" };
  const { rerender } = render(<RoleSelect {...props} open />);
  expect(screen.getByRole("img", { name: "화랑" })).toHaveAttribute("src", expect.stringContaining("warrior-portrait"));
  fireEvent.click(screen.getByRole("button", { name: "다음 역할" }));
  rerender(<RoleSelect {...props} open={false} />);
  rerender(<RoleSelect {...props} open />);
  expect(screen.getByRole("heading", { name: "화랑" })).toBeInTheDocument();
});

test("닫혀 있으면 아무것도 그리지 않는다", () => {
  render(<RoleSelect onClose={() => {}} onSelect={() => {}} open={false} selectedKey="king" />);

  expect(screen.queryByText("역할 선택")).not.toBeInTheDocument();
});
