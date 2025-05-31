// Initialize Firebase
import { firebaseConfig } from './firebaseConfig.js';
import { discordConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';

const app = initializeApp(firebaseConfig);

// Set up auth state listener
firebase.auth().onAuthStateChanged((user) => {
    const loginBtn = document.getElementById("discord-login");
    const userMenu = document.getElementById("user-menu-container");
    
    if (!loginBtn || !userMenu) {
        console.log('loginBtn:', loginBtn, 'userMenu:', userMenu);
        let missing = [];
        if (!loginBtn) missing.push('loginBtn');
        if (!userMenu) missing.push('userMenu');
        console.warn(`dclogin.js: 以下元素不存在 [${missing.join(', ')}]，跳過 onAuthStateChanged`);
        return; // 頁面沒有這些元素就直接跳過
    }
    
    if (user) {
        // 顯示 user menu
        loginBtn.style.display = "none";
        userMenu.style.display = "inline-block";
        document.getElementById("user-name").textContent = user.displayName || "已登入";
        if (user.photoURL) {
            const avatar = document.getElementById("user-avatar");
            avatar.src = user.photoURL;
            avatar.style.display = "inline-block";
        }
        // 綁定登出
        document.getElementById("logout-btn").onclick = logout;
        // 下拉選單切換
        const userMenuBtn = document.getElementById('user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenuBtn && userDropdown) {
            userMenuBtn.onclick = function(e) {
                e.stopPropagation();
                userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
            };
            document.addEventListener('click', function() {
                userDropdown.style.display = 'none';
            });
        }
        loadUserData(user.uid);
    } else {
        // 顯示登入按鈕
        loginBtn.style.display = "";
        userMenu.style.display = "none";
        loginBtn.onclick = loginWithDiscord;
    }
});

function loginWithDiscord() {
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${discordConfig.clientId}&response_type=code&redirect_uri=${encodeURIComponent(discordConfig.redirectUri)}&scope=${discordConfig.scope.replace(' ', '+')}`;
    window.location.href = authUrl;
}

function logout() {
    firebase.auth().signOut()
        .then(() => {
            window.location.reload();
        })
        .catch((error) => {
            console.error("Error signing out:", error);
        });
}

function loadUserData(uid) {
    firebase.firestore().collection('users').doc(uid).get()
        .then((doc) => {
            if (doc.exists) {
                const user = doc.data();
                console.log("User data loaded:", user);
            } else {
                console.log("No user data found");
            }
        })
        .catch((error) => {
            console.error("Error loading user data:", error);
        });
}
