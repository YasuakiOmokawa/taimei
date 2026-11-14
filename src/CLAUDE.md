# src

- 契約 (`spa-contract.ts`) の payload の schema には JSON の形と要求の大きさの上限 (配列の件数など) だけを書き、値の意味 (id の形・レベルの範囲) は Service が decode して tagged error にする。
