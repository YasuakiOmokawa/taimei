-- 連鎖削除を付けず FK の向きに並べる: 本番だけにある依存 (view・FK) を巻き添えにせず適用を失敗させる (0002 で連鎖削除を外したのと同じ理由)。
-- 6 テーブルの本番の行は開発者のテストデータだけなので、退避せずに消す。
DROP TABLE "_invoicesTotags";--> statement-breakpoint
DROP TABLE "invoices";--> statement-breakpoint
DROP TABLE "customers";--> statement-breakpoint
DROP TABLE "tags";--> statement-breakpoint
DROP TABLE "tags2";--> statement-breakpoint
DROP TABLE "revenue";
