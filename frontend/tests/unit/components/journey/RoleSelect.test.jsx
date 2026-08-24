import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import RoleSelect, { ROLES } from "../../../../components/journey/RoleSelect";

test("여섯 역할을 모두 보여주고 전부 코스가 준비돼 있다", () => {
  render(<RoleSelect onClose={() => {}} onSelect={() => {}} open selectedKey="king" />);

  for (const role of ROLES) {
    expect(screen.getByText(role.name)).toBeInTheDocument();
  }
  // 역할별 적합도 점수가 채워져 있어 여섯 역할 모두 코스를 뽑을 수 있다.
  expect(screen.getAllByText("코스 준비됨")).toHaveLength(ROLES.length);
  expect(screen.queryByText("준비 중")).not.toBeInTheDocument();
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
