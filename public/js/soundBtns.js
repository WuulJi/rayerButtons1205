// 從 Firestore 讀取並產生音效按鈕
// 需先在 index.html 載入 firebase 相關 SDK (app, auth, firestore)

document.addEventListener('DOMContentLoaded', () => {
    const buttonGrid = document.querySelector('.button-grid');

    if (!buttonGrid) {
        console.warn('soundBtns.js: .button-grid element not found. Cannot create sound buttons.');
        return;
    }

    // 確保 Firebase SDK 已載入且 Firestore 可用
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error('soundBtns.js: Firebase Firestore SDK is not loaded. Cannot create sound buttons.');
        // 你可能想在這裡提示使用者，或嘗試延遲執行/重試
        return;
    }

    const db = firebase.firestore();

    db.collection('sounds').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        buttonGrid.innerHTML = ''; // 清空舊按鈕，避免重複

        if (snapshot.empty) {
            // console.log("No sounds found in Firestore.");
            // 你可以在這裡顯示一個 "尚無音效" 的訊息
            // e.g., buttonGrid.innerHTML = '<p>尚無音效，快上傳你的第一個音效吧！</p>';
            return;
        }

        snapshot.forEach(doc => {
            const sound = doc.data();
            if (!sound.name || !sound.url) {
                console.warn('Skipping sound due to missing name or URL:', { id: doc.id, ...sound });
                return; // 跳過缺少必要資料的音效
            }

            // 創建按鈕元素
            const buttonElement = document.createElement('button');
            buttonElement.className = 'sound-button';
            
            // 創建 span 元素放置標籤
            const spanElement = document.createElement('span');
            spanElement.className = 'button-label';
            spanElement.textContent = sound.name; // 使用 Firestore 中的 name
            buttonElement.appendChild(spanElement);

            // 創建音效物件
            const audio = new Audio(sound.url); // 使用 Firestore 中的 url
            
            // 將 audio 物件附加到按鈕元素上，方便之後控制
            buttonElement.audioObject = audio;

            buttonElement.addEventListener('click', () => {
                // 停止其他正在播放的音效 (視覺效果 + 實際暫停)
                document.querySelectorAll('.sound-button.playing').forEach(btn => {
                    if (btn !== buttonElement) {
                        btn.classList.remove('playing');
                        if (btn.audioObject && typeof btn.audioObject.pause === 'function') {
                            btn.audioObject.pause();
                            // 如果希望其他音效也從頭開始，可以加上：
                            // btn.audioObject.currentTime = 0; 
                        }
                    }
                });
                
                // 播放或暫停目前音效
                if (audio.paused) {
                    audio.currentTime = 0; // 確保從頭播放
                    audio.play()
                        .then(() => {
                            buttonElement.classList.add('playing');
                        })
                        .catch(error => {
                            console.error("Error playing audio:", {error, soundName: sound.name, soundUrl: sound.url});
                            // 可以考慮移除 playing class，如果播放失敗
                            buttonElement.classList.remove('playing');
                        });
                } else {
                    audio.pause();
                    buttonElement.classList.remove('playing');
                }
            });
            
            // 音效播放結束後移除播放狀態
            audio.onended = () => {
                buttonElement.classList.remove('playing');
            };

            buttonGrid.appendChild(buttonElement);
        });
    }, error => {
        console.error("Error fetching sounds from Firestore: ", error);
        // 你可以在這裡顯示一個錯誤訊息給使用者
        // e.g., buttonGrid.innerHTML = '<p>讀取音效失敗，請稍後再試。</p>';
    });
});