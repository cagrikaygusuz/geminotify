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
    chrome.runtime.sendMessage({
      type: 'notification',
      title: title,
      message: message,
      url: window.location.href
    });
  }

  // Gemini sayfasını izle
  function monitorGemini() {
    let lastUserMessage = '';
    let isThinking = false;
    let lastResponseLength = 0;

    // Input alanını izle
    const inputObserver = new MutationObserver(() => {
      const inputArea = document.querySelector(geminiSelectors.inputArea);
      if (inputArea && inputArea.value.trim()) {
        lastUserMessage = inputArea.value.trim();
      }
    });

    // Mesaj alanını izle
    const messageObserver = new MutationObserver(() => {
      // Düşünme durumunu kontrol et
      const thinkingElements = document.querySelectorAll(geminiSelectors.thinkingIndicator);
      const currentlyThinking = thinkingElements.length > 0 && 
        Array.from(thinkingElements).some(el => el.offsetParent !== null);

      if (currentlyThinking && !isThinking) {
        isThinking = true;
        lastResponseLength = 0;
      }

      // Cevapları kontrol et
      const responseElements = document.querySelectorAll(geminiSelectors.messages);
      if (responseElements.length > 0) {
        const latestResponse = Array.from(responseElements).pop();
        const responseText = latestResponse.textContent || latestResponse.innerText || '';
        
        if (isThinking && responseText.length > lastResponseLength && responseText.length > 50) {
          // Cevap geldi
          isThinking = false;
          lastResponseLength = responseText.length;
          
          if (lastUserMessage) {
            sendNotification('Gemini Cevap Verdi', 'Sorunuzun cevabı hazır!');
            lastUserMessage = '';
          }
        }
      }
    });

    // Sayfa yüklendiğinde observer'ları başlat
    setTimeout(() => {
      const inputArea = document.querySelector(geminiSelectors.inputArea);
      if (inputArea) {
        inputObserver.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }

      messageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }, 2000);
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
