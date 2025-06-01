/**
 * 通知後端 API，請後端幫忙通知 Discord Webhook
 * @param {Object} params
 * @param {string} params.notifyUrl - Cloud Function 完整 URL
 * @param {string} params.uploader - 上傳者名稱
 * @param {string} params.soundName - 音檔名稱
 * @param {string} params.soundDate - 原影片日期
 * @param {string} params.soundTime - 時間戳記 (hhmm)
 * @returns {Promise<Response>}
 */
export async function notifyDiscord({ notifyUrl, uploader, soundName, soundDate, soundTime, idToken }) {
  const notificationPayload = {
    uploader,
    soundName,
    soundDate,
    soundTime
  };

  try {
    const response = await fetch(notifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`  // 驗證 Firebase Auth Token
      },
      body: JSON.stringify(notificationPayload)
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Error sending notification to backend:', response.status, text);
    } else {
      console.log('Notification request sent to backend successfully.');
    }
    return response;
  } catch (err) {
    console.error('Failed to send notification request to backend:', err);
    throw err;
  }
}