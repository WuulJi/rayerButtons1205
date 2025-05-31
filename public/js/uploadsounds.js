// 音效上傳功能（使用自訂 modal 表單）
// 需先在 index.html 載入 firebase 相關 SDK

// 建立 modal HTML
function createUploadModal() {
  let modal = document.getElementById('upload-audio-modal');
  if (modal) return modal; // 已存在就不重複建立

  // 如果 modal 不存在，則動態建立一個 div 元素作為 modal 的容器
  modal = document.createElement('div');
  modal.id = 'upload-audio-modal';  // 設定 modal 的 ID，方便之後選取

  // 使用 template literal (反引號 `` ` ``) 來定義 modal 的內部 HTML 結構
  modal.innerHTML = `
  <div class="modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:9998;"></div>
  <div class="modal-content" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:32px 24px;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.18);z-index:9999;min-width:300px;max-width:90vw;">
    <h2 style="margin-bottom:18px;">上傳音效</h2>
    <div style="font-size:0.95em;color:#555;margin-bottom:12px;">
      <b>說明：</b><br>
      「日期」請填寫音效原影片的發布日期。<br>
      「時間」請填寫音效在影片中的時間戳記（格式：小時:分鐘，例如 01:22）。
    </div>
    <form id="upload-audio-form">
      <label>名稱：<input type="text" id="audio-name" required maxlength="30" style="width:100%;margin-bottom:10px;"></label><br>
      <label>日期（原影片發布日期）：<input type="date" id="audio-date" required style="width:100%;margin-bottom:10px;"></label><br>
      <label>時間（音效在影片中的時間戳記）：<input type="text" id="audio-time" required pattern="^\\d{2}:\\d{2}$" placeholder="hh:mm" style="width:100%;margin-bottom:10px;"></label><br>
      <label>選擇 mp3 檔案：<input type="file" id="audio-file" accept=".mp3,audio/mp3,audio/mpeg" required style="margin-bottom:10px;"></label><br>
      <div id="audio-upload-error" style="color:#d00;margin-bottom:10px;"></div>
      <button type="submit" style="background:#5865F2;color:#fff;padding:8px 24px;border:none;border-radius:4px;cursor:pointer;">上傳</button>
      <button type="button" id="audio-upload-cancel" style="margin-left:10px;">取消</button>
    </form>
  </div>
`;

  // 將建立好的 modal 加入到網頁的 body 中
  document.body.appendChild(modal);
  return modal;  // 回傳建立好的 modal 元素
}

function showUploadModal() {
  const modal = createUploadModal();  // 取得或建立 modal
  modal.style.display = 'block';  // 將 modal 設為可見
  
  // 幫背景和取消按鈕加上點擊事件，點擊時關閉 modal
  modal.querySelector('.modal-backdrop').onclick = closeUploadModal;
  modal.querySelector('#audio-upload-cancel').onclick = closeUploadModal;
}

function closeUploadModal() {
  const modal = document.getElementById('upload-audio-modal');
  if (modal) modal.style.display = 'none';  // 將 modal 設為隱藏
}

const uploadBtn = document.getElementById('upload-audio-btn');
if (uploadBtn) {
  uploadBtn.addEventListener('click', showUploadModal);
}

// 表單提交處理
function handleUploadFormSubmit(e) {
  e.preventDefault();  // 防止表單提交導致頁面刷新

   // 從表單中取得使用者輸入的值
  const name = document.getElementById('audio-name').value.trim();
  const date = document.getElementById('audio-date').value;
  const time = document.getElementById('audio-time').value;
  const fileInput = document.getElementById('audio-file');
  const file = fileInput.files[0];
  const errorDiv = document.getElementById('audio-upload-error');
  errorDiv.textContent = '';  // 清空先前的錯誤訊息

  // ---- 前端驗證 ----
  if (!name || !date || !time || !file) {
    errorDiv.textContent = '請完整填寫所有欄位並選擇檔案';
    return;
  }
  // 名稱不允許底線，避免與檔名組合衝突
  if (name.includes('_')) {
    errorDiv.textContent = '名稱不能包含底線 _';
    return;
  }
  // 日期格式 YYYY-MM-DD 轉 YYYYMMDD
  const dateStr = date.replace(/-/g, '');
  if (!/^\d{8}$/.test(dateStr)) {
    errorDiv.textContent = '日期格式錯誤';
    return;
  }
  // 時間格式 hh:mm 轉 hhmm
  const timeStr = time.replace(':', '');
  if (!/^\d{2}:\d{2}$/.test(time)) {
    errorDiv.textContent = '時間格式錯誤，請輸入 hh:mm（如 01:22）';
    return;
  }
  // 檢查副檔名與 MIME type
  const isMp3 = file.type === 'audio/mp3' || file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
  if (!isMp3) {
    errorDiv.textContent = '只允許上傳 mp3 檔案';
    return;
  }
  // ---- 組合檔名 ----
  const filename = `${name}_${dateStr}_${timeStr}.mp3`;

  // ---- 上傳音效 ----
  (async () => {
    try {
      const user = firebase.auth().currentUser;  // 取得目前登入的使用者
      if (!user) {
        errorDiv.textContent = '請先登入';
        return;
      }
      // 建立 Firebase Storage 的參照路徑(根目錄:sounds/)
      const storageRef = firebase.storage().ref('sounds/' + filename);
      // 上傳檔案
      const uploadTask = await storageRef.put(file);
      // 取得上傳後的檔案下載連結
      const url = await uploadTask.ref.getDownloadURL();
      // 寫入 Firestore
      await firebase.firestore().collection('sounds').add({
        name: name,
        date: dateStr,
        time: timeStr,
        url: url,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        uploader: user.uid,
        uploaderName: user.displayName || '' // 如果 user.displayName 沒有值（例如使用者沒有設置名稱），就用空字串 '' 代替，避免出現 undefined
        // 或從 Firestore users collection 讀 username
      });
      closeUploadModal();
      alert('上傳成功！');
    } catch (err) {
      console.error('上傳失敗', err);
      errorDiv.textContent = '上傳失敗：' + err.message;
    }
  })();
}

// 綁定表單 submit
// 用事件代理，因為 modal 可能是動態產生
window.addEventListener('submit', function(e) {
  if (e.target && e.target.id === 'upload-audio-form') {
    handleUploadFormSubmit(e);
  }
});
