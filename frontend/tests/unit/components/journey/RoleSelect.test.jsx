import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import RoleSelect, { ROLES } from "../../../../components/journey/RoleSelect";

test("여섯 역할을 모두 보여주고 준비 상태를 구분한다", () => {
  render(<RoleSelect onClose={() => {}} onSelect={() => {}} open selectedKey="king" />);

  for (const role of ROLES) {
    expect(screen.getByText(role.name)).toBeInTheDocument();
  }
  // 코스 규칙이 있는 역할은 왕뿐이다.
  expect(screen.getAllByText("코스 준비됨")).toHaveLength(1);
  expect(screen.getAllByText("준비 중")).toHaveLength(ROLES.length - 1);
});

test("역할을 고르면 그 역할을 알려준다", () => {
  const onSelect = vi.fn();
  render(<RoleSelect onClose={() => {}} onSelect={onSelect} open selectedKey="king" />);

  fireEvent.click(screen.getByText("학자"));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "scholar" }));
});

test("닫혀 있으면 아무것도 그리지 않는다", () => {
  render(<RoleSelect onClose={() => {}} onSelect={() => {}} open={false} selectedKey="king" />);

  expect(screen.queryByText("역할 선택")).not.toBeInTheDocument();
});
