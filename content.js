// Gemini ve NotebookLM için bildirim gönderici content script

(function() {
  'use strict';

  let isWaitingForResponse = false;
  let lastMessageCount = 0;
  let lastResponseText = '';
  let checkInterval = null;

  // Site tespiti
  const isGemini = window.location.hostname === 'gemini.google.com';
  const isNotebookLM = window.location.hostname === 'notebooklm.google.com';

  // Gemini için selector'lar
  const geminiSelectors = {
    inputArea: 'textarea[placeholder*="Enter a prompt"], textarea[aria-label*="prompt"], textarea[data-placeholder]',
    messages: '[data-message-author-role="model"], .response-text, [class*="message"], [class*="response"]',
    thinkingIndicator: '[class*="thinking"], [class*="loading"], [aria-label*="thinking"]',
    sendButton: 'button[type="submit"], button[aria-label*="Send"], button[data-testid*="send"]'
  };

  // NotebookLM için selector'lar
  const notebookLMSelectors = {
    inputArea: 'textarea[placeholder*="message"], textarea[aria-label*="message"], input[type="text"]',
    messages: '[class*="message"], [class*="response"], [data-role="assistant"]',
    thinkingIndicator: '[class*="loading"], [class*="spinner"], [aria-busy="true"]',
    sendButton: 'button[type="submit"], button[aria-label*="Send"], button[data-testid*="send"]',
    studioTasks: '[class*="task"], [class*="studio"], [data-status*="complete"]'
  };

  // Bildirim gönder
  function sendNotification(title, message) {
    console.log('[Gemini Notify] Bildirim gönderiliyor:', title, message);
    try {
      chrome.runtime.sendMessage({
        type: 'notification',
        title: title,
        message: message,
        url: window.location.href
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Gemini Notify] Bildirim hatası:', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          console.log('[Gemini Notify] Bildirim başarıyla gönderildi');
        } else {
          console.warn('[Gemini Notify] Bildirim yanıtı:', response);
        }
      });
    } catch (error) {
      console.error('[Gemini Notify] Bildirim gönderme hatası:', error);
    }
  }

  // Gemini sayfasını izle
  function monitorGemini() {
    console.log('[Gemini Notify] İzleme başlatılıyor...');
    
    let userMessageSent = false;
    let lastResponseHash = '';
    let responseCheckCount = 0;
    let isWaitingForResponse = false;
    
    // Gönder butonunu ve input alanını bul
    function findInputAndButton() {
      // Farklı selector'ları dene
      const selectors = [
        'textarea[aria-label*="prompt"]',
        'textarea[placeholder*="prompt"]',
        'textarea[data-placeholder]',
        'textarea',
        'div[contenteditable="true"][role="textbox"]'
      ];
      
      let inputArea = null;
      for (const selector of selectors) {
        inputArea = document.querySelector(selector);
        if (inputArea && inputArea.offsetParent !== null) {
          console.log('[Gemini Notify] Input bulundu:', selector);
          break;
        }
      }
      
      // Gönder butonunu bul
      const buttonSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="Gönder"]',
        'button[type="submit"]',
        'button[data-testid*="send"]',
        'button:has(svg)'
      ];
      
      let sendButton = null;
      for (const selector of buttonSelectors) {
        const buttons = Array.from(document.querySelectorAll(selector));
        sendButton = buttons.find(btn => {
          const text = btn.textContent || btn.getAttribute('aria-label') || '';
          return text.toLowerCase().includes('send') || 
                 text.toLowerCase().includes('gönder') ||
                 btn.querySelector('svg');
        });
        if (sendButton) {
          console.log('[Gemini Notify] Gönder butonu bulundu');
          break;
        }
      }
      
      return { inputArea, sendButton };
    }
    
    // Event listener'ları sakla
    let sendButtonListener = null;
    let inputListener = null;
    
    // Gönder butonuna tıklama olayını dinle
    function setupSendButtonListener() {
      const { sendButton } = findInputAndButton();
      if (sendButton && !sendButton.dataset.notifyListenerAdded) {
        sendButton.dataset.notifyListenerAdded = 'true';
        sendButtonListener = () => {
          console.log('[Gemini Notify] Mesaj gönderildi');
          userMessageSent = true;
          isWaitingForResponse = true;
          responseCheckCount = 0;
        };
        sendButton.addEventListener('click', sendButtonListener);
        console.log('[Gemini Notify] Gönder butonu listener eklendi');
      }
    }
    
    // Input alanına Enter tuşu ile göndermeyi dinle
    function setupInputListener() {
      const { inputArea } = findInputAndButton();
      if (inputArea && !inputArea.dataset.notifyListenerAdded) {
        inputArea.dataset.notifyListenerAdded = 'true';
        inputListener = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            console.log('[Gemini Notify] Enter ile mesaj gönderildi');
            setTimeout(() => {
              userMessageSent = true;
              isWaitingForResponse = true;
              responseCheckCount = 0;
            }, 100);
          }
        };
        inputArea.addEventListener('keydown', inputListener);
        console.log('[Gemini Notify] Input listener eklendi');
      }
    }
    
    // Cevapları kontrol et
    function checkForResponse() {
      if (!isWaitingForResponse) return;
      
      responseCheckCount++;
      
      // Tüm olası cevap alanlarını kontrol et
      const responseSelectors = [
        '[data-message-author-role="model"]',
        '[class*="model-message"]',
        '[class*="response"]',
        '[class*="message"]',
        'div[data-testid*="message"]',
        'div[role="article"]'
      ];
      
      let foundResponse = null;
      for (const selector of responseSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // En son eklenen mesajı bul
          const lastElement = Array.from(elements).pop();
          const text = lastElement.textContent || lastElement.innerText || '';
          
          // Kullanıcı mesajı değilse ve yeterince uzunsa
          if (text.length > 50 && !text.includes('Thinking...') && !text.includes('Düşünüyor')) {
            const textHash = text.substring(0, 100);
            if (textHash !== lastResponseHash) {
              foundResponse = text;
              lastResponseHash = textHash;
            }
          }
        }
      }
      
      // Alternatif: Sayfadaki tüm text içeriğini kontrol et
      if (!foundResponse) {
        const allTextElements = document.querySelectorAll('div, p, span');
        let lastLargeText = '';
        let lastLargeElement = null;
        
        allTextElements.forEach(el => {
          const text = el.textContent || el.innerText || '';
          if (text.length > 100 && 
              el.offsetParent !== null &&
              !el.querySelector('textarea') &&
              !el.querySelector('input')) {
            if (text.length > lastLargeText.length) {
              lastLargeText = text;
              lastLargeElement = el;
            }
          }
        });
        
        if (lastLargeText && lastLargeText !== lastResponseHash) {
          const textHash = lastLargeText.substring(0, 100);
          if (textHash !== lastResponseHash && lastLargeText.length > 50) {
            foundResponse = lastLargeText;
            lastResponseHash = textHash;
          }
        }
      }
      
      // Düşünme göstergelerini kontrol et
      const thinkingSelectors = [
        '[class*="thinking"]',
        '[class*="loading"]',
        '[aria-label*="thinking"]',
        '[aria-label*="loading"]',
        '*[class*="spinner"]'
      ];
      
      let isThinking = false;
      for (const selector of thinkingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          isThinking = Array.from(elements).some(el => el.offsetParent !== null);
          if (isThinking) break;
        }
      }
      
      // Eğer düşünme durumu bitti ve cevap varsa
      if (foundResponse && !isThinking && userMessageSent) {
        console.log('[Gemini Notify] Cevap bulundu! Bildirim gönderiliyor...');
        sendNotification('Gemini Cevap Verdi', 'Sorunuzun cevabı hazır!');
        userMessageSent = false;
        isWaitingForResponse = false;
        lastResponseHash = foundResponse.substring(0, 100);
      }
      
      // 30 saniye sonra timeout
      if (responseCheckCount > 60) {
        console.log('[Gemini Notify] Timeout - izleme durduruluyor');
        isWaitingForResponse = false;
        userMessageSent = false;
      }
    }
    
    // Sayfa yüklendiğinde başlat
    function startMonitoring() {
      console.log('[Gemini Notify] İzleme başlatıldı');
      
      setupSendButtonListener();
      setupInputListener();
      
      // Her 500ms'de bir kontrol et
      const checkInterval = setInterval(checkForResponse, 500);
      
      // Sayfa değiştiğinde yeniden başlat
      const urlObserver = new MutationObserver(() => {
        if (location.href !== (window.lastGeminiUrl || '')) {
          window.lastGeminiUrl = location.href;
          console.log('[Gemini Notify] Sayfa değişti, yeniden başlatılıyor...');
          clearInterval(checkInterval);
          setTimeout(startMonitoring, 1000);
        }
      });
      
      urlObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // DOM değişikliklerini izle (debounce ile)
      let domCheckTimeout = null;
      const domObserver = new MutationObserver(() => {
        // Debounce: 1 saniye içinde sadece bir kez kontrol et
        if (domCheckTimeout) clearTimeout(domCheckTimeout);
        domCheckTimeout = setTimeout(() => {
          setupSendButtonListener();
          setupInputListener();
        }, 1000);
      });
      
      domObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    // Sayfa yüklendiğinde başlat
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(startMonitoring, 2000);
      });
    } else {
      setTimeout(startMonitoring, 2000);
    }
  }

  // NotebookLM chat'i izle
  function monitorNotebookLMChat() {
    let lastUserMessage = '';
    let isThinking = false;
    let lastResponseLength = 0;
    let messageCount = 0;

    const messageObserver = new MutationObserver(() => {
      // Düşünme durumunu kontrol et
      const thinkingElements = document.querySelectorAll(notebookLMSelectors.thinkingIndicator);
      const currentlyThinking = thinkingElements.length > 0 && 
        Array.from(thinkingElements).some(el => el.offsetParent !== null);

      if (currentlyThinking && !isThinking) {
        isThinking = true;
        lastResponseLength = 0;
      }

      // Mesajları kontrol et
      const messages = document.querySelectorAll(notebookLMSelectors.messages);
      if (messages.length > messageCount) {
        messageCount = messages.length;
        
        if (isThinking) {
          const latestMessage = Array.from(messages).pop();
          const responseText = latestMessage.textContent || latestMessage.innerText || '';
          
          if (responseText.length > lastResponseLength && responseText.length > 50) {
            isThinking = false;
            lastResponseLength = responseText.length;
            sendNotification('NotebookLM Cevap Verdi', 'Chat cevabınız hazır!');
          }
        }
      }
    });

    // Input alanını izle
    const inputObserver = new MutationObserver(() => {
      const inputArea = document.querySelector(notebookLMSelectors.inputArea);
      if (inputArea && inputArea.value.trim()) {
        lastUserMessage = inputArea.value.trim();
      }
    });

    setTimeout(() => {
      messageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      inputObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }, 2000);
  }

  // NotebookLM Studio görevlerini izle
  function monitorNotebookLMStudio() {
    let completedTasks = new Set();
    let lastTaskCount = 0;

    const taskObserver = new MutationObserver(() => {
      const tasks = document.querySelectorAll(notebookLMSelectors.studioTasks);
      
      if (tasks.length > lastTaskCount) {
        lastTaskCount = tasks.length;
        
        tasks.forEach(task => {
          const taskId = task.getAttribute('data-id') || task.textContent.substring(0, 50);
          const status = task.getAttribute('data-status') || 
                        task.className.includes('complete') ? 'complete' : 'pending';
          
          if (status === 'complete' && !completedTasks.has(taskId)) {
            completedTasks.add(taskId);
            sendNotification('NotebookLM Studio Görevi Tamamlandı', 'Göreviniz tamamlandı!');
          }
        });
      }
    });

    // Alternatif: Görev durumunu kontrol etmek için periyodik kontrol
    const checkTasks = setInterval(() => {
      const tasks = document.querySelectorAll('[class*="task"], [class*="studio-item"]');
      
      tasks.forEach(task => {
        const taskText = task.textContent || '';
        const isComplete = task.className.includes('complete') || 
                          task.className.includes('done') ||
                          task.getAttribute('aria-label')?.includes('complete');
        
        if (isComplete && !completedTasks.has(taskText)) {
          completedTasks.add(taskText);
          sendNotification('NotebookLM Studio Görevi Tamamlandı', 'Göreviniz tamamlandı!');
        }
      });
    }, 3000);

    setTimeout(() => {
      taskObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-status']
      });
    }, 2000);
  }

  // Sayfa yüklendiğinde uygun izlemeyi başlat
  if (isGemini) {
    monitorGemini();
  } else if (isNotebookLM) {
    monitorNotebookLMChat();
    monitorNotebookLMStudio();
  }

  // Sayfa değiştiğinde (SPA navigasyonu için)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        if (isGemini) {
          monitorGemini();
        } else if (isNotebookLM) {
          monitorNotebookLMChat();
          monitorNotebookLMStudio();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
