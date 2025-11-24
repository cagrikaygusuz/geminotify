// Background service worker - Bildirim yönetimi

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'notification') {
    // Bildirim gönder
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: request.title || 'Bildirim',
      message: request.message || 'Yeni bir güncelleme var',
      priority: 2
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Bildirim hatası:', chrome.runtime.lastError);
      }
    });

    // Bildirime tıklandığında ilgili sekmeyi aç
    chrome.notifications.onClicked.addListener((notificationId) => {
      chrome.tabs.query({ url: request.url }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      });
      chrome.notifications.clear(notificationId);
    });
  }
  
  sendResponse({ success: true });
  return true;
});

// Bildirim izinlerini kontrol et
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.getPermissionLevel((level) => {
    if (level === 'denied') {
      console.warn('Bildirim izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
    }
  });
});
