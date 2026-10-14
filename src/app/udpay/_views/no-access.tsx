/** /billing に入れないとき（ログインユーザーが UD Payment の利用者として登録されていない） */
export function NoAccess() {
  return (
    <main className="up-container">
      <h1>ご利用いただけません</h1>
      <p className="up-error">
        このアカウントは UD Payment の利用者として登録されていません。お手数ですが、株式会社ユニバーサル・デベロップメントへお問い合わせください。
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="up-btn secondary">ログアウト</button>
      </form>
    </main>
  );
}
