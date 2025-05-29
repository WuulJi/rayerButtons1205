// Initialize Firebase
import { firebaseConfig } from './firebaseConfig.js';
import { discordConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';

const app = initializeApp(firebaseConfig);

// Set up auth state listener
firebase.auth().onAuthStateChanged((user) => {
    const loginBtn = document.getElementById("discord-login");
    if (loginBtn) {
        if (user) {
            // 用戶已登入
            loginBtn.innerHTML = `
                <img src="${user.photoURL || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_white_RGB.png'}" 
                     alt="Discord" 
                     class="discord-icon">
                ${user.displayName || '已登入'}
            `;
            loginBtn.onclick = logout;
            loadUserData(user.uid);
        } else {
            // 用戶未登入
            loginBtn.innerHTML = `
                <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_white_RGB.png" 
                     alt="Discord" 
                     class="discord-icon">
                使用 Discord 登入
            `;
            loginBtn.onclick = loginWithDiscord;
        }
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
