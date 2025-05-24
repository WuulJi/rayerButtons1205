class ButtonsService {
    async getButtons() {
        try {
            const response = await fetch('data.json');
            const data = await response.json();
            return data.soundButtons;
        } catch (error) {
            console.error('載入按鈕資料失敗:', error);
            return [];
        }
    }
}

// 移動端選單切換
document.addEventListener('DOMContentLoaded', async () => {
    //載入並取得data.json的資料
    const buttonsService = new ButtonsService();
    const soundButtons = await buttonsService.getButtons();
    
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // 創建音效按鈕
    const buttonGrid = document.querySelector('.button-grid');
    
    soundButtons.forEach(button => {
        // 創建按鈕元素
        const buttonElement = document.createElement('button');
        buttonElement.className = 'sound-button';
        // 創建 span 元素
        const spanElement = document.createElement('span');
        spanElement.className = 'button-label';
        spanElement.textContent = button.label;  // 使用 textContent 而不是 innerHTML
        // 將 span 加入到 button 中
        buttonElement.appendChild(spanElement);


        // 創建音效物件
        const audio = new Audio(button.soundUrl);
        
        buttonElement.addEventListener('click', () => {
            // 停止其他正在播放的音效 (其實只移除視覺效果，但沒關係，我喜歡)
            document.querySelectorAll('.sound-button').forEach(btn => {
                btn.classList.remove('playing');
            });
            
            // 播放音效
            audio.currentTime = 0;
            audio.play();
            buttonElement.classList.add('playing');
            
            // 音效播放結束後移除播放狀態
            audio.onended = () => {
                buttonElement.classList.remove('playing');
            };
        });
        
        buttonGrid.appendChild(buttonElement);
    });
});