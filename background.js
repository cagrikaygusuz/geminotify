// Background service worker - Bildirim yönetimi

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'notification') {
    // Bildirim gönder
    const notificationOptions = {
      type: 'basic',
      title: request.title || 'Bildirim',
      message: request.message || 'Yeni bir güncelleme var',
      priority: 2,
      requireInteraction: false,
      iconUrl: chrome.runtime.getURL('icons/icon48.png')
    };
    
    function handleNotificationCreated(notificationId, sender, sendResponse) {
      // Tab ID'yi notification ile ilişkilendir
      if (sender.tab && sender.tab.id) {
        chrome.storage.local.set({ [`notification_${notificationId}`]: sender.tab.id });
      }
      sendResponse({ success: true, notificationId: notificationId });
    }
    
    chrome.notifications.create(notificationOptions, (notificationId) => {
      if (chrome.runtime.lastError) {
        // Icon hatası olabilir, icon olmadan tekrar dene
        console.warn('Icon ile bildirim hatası:', chrome.runtime.lastError.message);
        delete notificationOptions.iconUrl;
        chrome.notifications.create(notificationOptions, (notificationId2) => {
          if (chrome.runtime.lastError) {
            console.error('Bildirim hatası:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          handleNotificationCreated(notificationId2, sender, sendResponse);
        });
      } else {
        handleNotificationCreated(notificationId, sender, sendResponse);
      }
    });
    
    return true; // Async response için
  }
  
  sendResponse({ success: true });
  return true;
});

// Bildirime tıklandığında tab'ı aç
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get([`notification_${notificationId}`], (result) => {
    const tabId = result[`notification_${notificationId}`];
    if (tabId) {
      chrome.tabs.get(tabId, (tab) => {
        if (tab && tab.windowId) {
          chrome.tabs.update(tabId, { active: true });
          chrome.windows.update(tab.windowId, { focused: true });
        }
      });
      chrome.storage.local.remove([`notification_${notificationId}`]);
    }
  });
  chrome.notifications.clear(notificationId);
});

// Bildirim izinlerini kontrol et
chrome.runtime.onInstalled.addListener(() => {
  chrome.notifications.getPermissionLevel((level) => {
    if (level === 'denied') {
      console.warn('Bildirim izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.');
    }
  });
});
