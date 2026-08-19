# GitHub Pages 部署教學（第一次也能完成版）

建議 Repository 名稱：`markdown-image-studio`

完成後網址通常會是：

`https://你的GitHub帳號.github.io/markdown-image-studio/`

## 一、建立 Repository

1. 登入 GitHub。
2. 點右上角的 `＋`，選擇 **New repository**。
3. `Repository name` 輸入 `markdown-image-studio`。
4. 選擇 **Public**。GitHub Free 的 Pages 網站需要公開 Repository。
5. 開啟 **Add a README file**。
6. 點 **Create repository**。

公開的是工具程式碼，不是你在工具裡輸入的文章。

## 二、上傳部署包內容

1. 在電腦上解壓縮 `Markdown-Image-Studio-PWA-1.0.1-GitHub-Pages-FLAT.zip`。
2. 回到剛建立的 Repository。
3. 點 **Add file** → **Upload files**。
4. 打開解壓縮後的資料夾，全選裡面的所有檔案，再拖到 GitHub 上傳區。
5. 確認上傳清單最上層可以直接看到 `index.html`、`app.bundle.js`、`boot.js`、`service-worker.js`、`manifest.webmanifest` 等檔案。
6. 在頁面底部點 **Commit changes**。

請勿只上傳 ZIP，也不要讓檔案多包在一層同名資料夾內；`index.html` 必須位於 Repository 根目錄。

這個修正版沒有必要的子資料夾；所有執行檔案都在同一層，使用 GitHub 網頁上傳時不會漏掉 Markdown 解析函式庫。

## 三、啟用 GitHub Pages

1. 在 Repository 上方點 **Settings**。若視窗較窄，可能藏在 `…` 選單。
2. 左側找到 **Code and automation** → **Pages**。
3. 在 **Build and deployment** 的 `Source` 選擇 **Deploy from a branch**。
4. `Branch` 選擇 **main**，資料夾選擇 **/(root)**。
5. 點 **Save**。
6. 等候幾分鐘後重新整理 Pages 設定頁，看到 **Visit site** 就代表完成。

GitHub 官方表示更新最久可能需要約 10 分鐘。剛設定後出現 404 時，先等等再重新整理，不一定是你做錯。

## 四、安裝到 iPhone 主畫面

1. 使用 iPhone 的 **Safari** 開啟 GitHub Pages 網址。
2. 等畫面完整載入，看到右上角狀態變成「已可離線」。
3. 點 Safari 的 **分享** 按鈕。
4. 選擇 **加入主畫面**。
5. 開啟 **以 Web App 方式開啟**，再點 **加入**。
6. 回到主畫面，開啟「文章圖片工坊」。

第一次載入需要網路。離線快取完成後，可以打開飛航模式再測試一次。

## 五、輸出與保存

- 點 **輸出圖片**，完成後會出現成果面板。
- 點 **分享全部圖片**，即可使用 iOS 分享選單儲存到照片、檔案或其他 App。
- 如果瀏覽器不支援一次分享多張，可以逐張點 **下載這張**，或長按圖片儲存。
- 點編輯器上方的 **備份 .md**，可將 Markdown 原稿保存到 iCloud Drive。

## 六、日後更新工具

取得新版部署包後，重複「上傳部署包內容」，允許 GitHub 覆蓋同名檔案並 Commit。重新開啟 Web App；若仍顯示舊版，完全關閉後再開一次。

## 常見問題

### 網站只有 README，沒有工具

通常是 `index.html` 沒有放在 Repository 根目錄，或 Pages 的資料夾不是 `/(root)`。

### 顯示 404

先回到 Settings → Pages 檢查是否選擇 `main` 與 `/(root)`，再等待約 10 分鐘。

### 加入主畫面後無法離線

先在有網路時重新開啟一次，確認狀態顯示「已可離線」，再測試飛航模式。Safari 的「清除網站資料」會一併移除離線快取與本機草稿。

### 文章會上傳到 GitHub 嗎？

不會。GitHub Pages 只託管工具本身；Markdown 解析、圖片渲染及檔案產生都在你的 iPhone 裡完成。

## 官方參考

- GitHub Pages 建立網站：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Apple 將網站加入 iPhone 主畫面：https://support.apple.com/guide/iphone/iphea86e5236/ios
