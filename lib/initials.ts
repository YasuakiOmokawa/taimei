// Avatar fallback 用のイニシャル文字列を生成する純粋関数。
// name 空欄時の表示は taimei-auth /account 側 Avatar fallback と意図的に揃えるため "??" を維持する。
export const getInitials = (name: string) => {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "??"
  );
};
