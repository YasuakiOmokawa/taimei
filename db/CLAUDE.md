# db

- 試験の seed は superuser の `tx` で書き、期待値も同じ `tx` で読む。アプリのコードに渡す db は `taimei_app` の role のものにする (Service に渡す所は lint と型が止める。`purgeDeparted` のように db を引数で受ける関数に渡す所は止まらない)。
- SQL の中でチームが見える範囲 (管理者か、割り当てられた人) を決めるのは関数 `team_visible_to` だけにする。
