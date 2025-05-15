const AI = (() => {
    const AI_API_KEY = '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';
    const AI_MODEL = 'openai/gpt-4o-mini';
    const AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

    let DOMElements, AppState, DebugHelper, UIManager;

    function chunkString(str, size) {
        const chunks = []; let i = 0;
        while (i < str.length) { chunks.push(str.slice(i, i + size)); i += size; }
        return chunks;
    }

    function displayAIChatPane() {
        AppState.activeView = 'aiChat'; AppState.activeItemId = null; AppState.activeItemType = null;
        UIManager.updateActiveNavItems();
        DOMElements.welcomeScreen.classList.add('hidden');
        DOMElements.docContentPane.classList.add('hidden');
        DOMElements.aiChatPane.classList.remove('hidden');
        DOMElements.aiChatInput.focus();
    }

    function addChatMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        const avatar = document.createElement('i');
        avatar.classList.add('fas', sender === 'user' ? 'fa-user-astronaut' : 'fa-robot', 'avatar');
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        if (sender === 'loading') {
            avatar.classList.add('fa-spinner', 'fa-spin'); avatar.classList.remove('fa-robot');
            messageContent.innerHTML = `<i>AI is thinking...</i>`; messageElement.classList.add('loading');
        } else { messageContent.textContent = message; }

        messageElement.appendChild(avatar); messageElement.appendChild(messageContent);
        DOMElements.aiChatMessages.appendChild(messageElement);
        DOMElements.aiChatMessages.scrollTop = DOMElements.aiChatMessages.scrollHeight;
        if (sender !== 'loading') AppState.chatHistory.push({ sender, message });
        return messageElement;
    }

    function typeMessageCharacterByCharacter(element, fullMessage, callback) {
        let mainContent = fullMessage; let sourceLine = ''; let sourceUrl = '';
        const sourceRegex = /Source:\s*(https?:\/\/[^\s]+)/i; const sourceMatch = fullMessage.match(sourceRegex);
        if (sourceMatch) { mainContent = fullMessage.substring(0, sourceMatch.index).trim(); sourceLine = sourceMatch[0]; sourceUrl = sourceMatch[1];}
        let i = 0; const typingSpeed = 25; element.innerHTML = '';
        function type() {
            if (i < mainContent.length) {
                element.innerHTML += mainContent.charAt(i); i++;
                DOMElements.aiChatMessages.scrollTop = DOMElements.aiChatMessages.scrollHeight; setTimeout(type, typingSpeed);
            } else {
                if (sourceUrl) {
                    if (mainContent.length > 0) { element.appendChild(document.createElement('br')); element.appendChild(document.createElement('br'));}
                    const sourcePrefix = document.createTextNode('Source: '); const link = document.createElement('a');
                    link.href = sourceUrl; link.target = '_blank'; link.textContent = sourceUrl;
                    link.style.color = 'var(--link-color, var(--accent-color))';
                    element.appendChild(sourcePrefix); element.appendChild(link);
                }
                DOMElements.aiChatMessages.scrollTop = DOMElements.aiChatMessages.scrollHeight; if (callback) callback();
            }
        } type();
    }

    function updateLastAIMessage(element, message, isError = false) {
        const messageContentElement = element.querySelector('.message-content'); const avatarElement = element.querySelector('.avatar');
        if (messageContentElement && avatarElement) {
            avatarElement.classList.remove('fa-spinner', 'fa-spin');
            if (!avatarElement.classList.contains('fa-robot')) avatarElement.classList.add('fa-robot');
            element.classList.remove('loading');
            if (isError) {
                messageContentElement.innerHTML = ''; messageContentElement.appendChild(document.createTextNode(message));
                element.classList.add('error'); AppState.chatHistory.push({ sender: 'ai', message });
            } else { typeMessageCharacterByCharacter(messageContentElement, message, () => { AppState.chatHistory.push({ sender: 'ai', message });});}
        } DOMElements.aiChatMessages.scrollTop = DOMElements.aiChatMessages.scrollHeight;
    }

    async function sendChatMessageToAPI(userMessage) {
        DOMElements.aiChatSendButton.disabled = true;
        const loadingMessageElement = addChatMessage('', 'loading');
        try {
            let combinedGameData = "You are a helpful assistant knowledgeable about Roblox Islands. Use the following data to answer questions. Do not make up information if it's not in the provided data. If data is missing, say you don't have that specific information.\n\n--- EXPLORE ITEMS ---\n\n";
            
            if (AppState.allDocuments && AppState.allDocuments.length > 0) {
                 AppState.allDocuments.forEach(doc => {
                    combinedGameData += `Title: ${doc.title.replace(/_/g, ' ')}\nContent:\n${doc.actualContent || 'Content not available for this item.'}\n\n`;
                 });
            } else { combinedGameData += "No explore item data seems to be loaded.\n\n"; }

            combinedGameData += "\n\n--- CATEGORY ITEMS ---\n\n";
            if (AppState.allCategories && AppState.allCategories.length > 0) {
                AppState.allCategories.forEach(cat => {
                   combinedGameData += `Category Title: ${cat.title.replace(/_/g, ' ')}\nContent:\n${cat.actualContent || 'Content not available for this category item.'}\n\n`;
                });
           } else { combinedGameData += "No category item data seems to be loaded.\n\n"; }
            
            if (AppState.allDocuments.length === 0 && AppState.allCategories.length === 0) {
                UIManager.showToast("AI Chat: No detailed game data available for context.", "warning");
            }

            const CHUNK_SIZE = 7000; const MAX_CHUNKS = 9; 
            const gameDataChunks = chunkString(combinedGameData, CHUNK_SIZE).slice(0, MAX_CHUNKS);
            const systemMessages = gameDataChunks.map(chunk => ({ role: 'system', content: chunk }));
            if(gameDataChunks.length === 0 && combinedGameData.length > 0) systemMessages.push({role: 'system', content: combinedGameData});

            const historicalMessages = AppState.chatHistory.filter(entry => entry.sender !== 'loading').slice(-8).map(entry => ({ role: entry.sender==='user'?'user':'assistant', content: entry.message}));
            const messagesForAPI = [...systemMessages, ...historicalMessages, { role: 'user', content: userMessage }];
            const requestPayload = { model: AI_MODEL, messages: messagesForAPI, max_tokens: 1200 };

            DebugHelper.sendToDiscord('AI Chat: Sending Request', 'debug_ai', { userQuery: userMessage, payloadTokenEstimate: JSON.stringify(requestPayload).length / 3.5 });
            const apiResponse = await fetch(AI_API_URL, { method: 'POST', headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${AI_API_KEY}`}, body: JSON.stringify(requestPayload)});
            const responseData = await apiResponse.json();
            if (!apiResponse.ok || responseData.error) throw new Error(`API Error (${apiResponse.status}): ${responseData.error?.message || 'Unknown error'}`);
            const aiReply = responseData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't get a response from the AI at this moment.";
            updateLastAIMessage(loadingMessageElement, aiReply);
            DebugHelper.sendToDiscord('AI Chat: Received Response', 'debug_ai', { userQuery: userMessage, aiResponsePreview: aiReply.substring(0,200) + "..."});
        } catch (error) {
            updateLastAIMessage(loadingMessageElement, `Error communicating with AI: ${error.message}`, true);
            UIManager.showToast(`AI Chat Error: ${error.message}`, 'error');
            DebugHelper.sendToDiscord('AI Chat API Exception', 'error', { userQuery: userMessage, error: error.message, stack: error.stack ? error.stack.substring(0,500) : "N/A"});
        } finally { DOMElements.aiChatSendButton.disabled = false; DOMElements.aiChatInput.focus(); }
    }

    function handleAIChatSelection() { displayAIChatPane(); DebugHelper.sendToDiscord('AI Chat view selected', 'action'); }
    function handleAIChatSend() {
        const message = DOMElements.aiChatInput.value.trim();
        if (message) { addChatMessage(message, 'user'); DOMElements.aiChatInput.value = ''; sendChatMessageToAPI(message); DebugHelper.sendToDiscord('User sent chat message', 'chat', { query: message.substring(0,100) + "..."});}
    }

    return {
        init: (domElementsRef, appStateRef, debugHelperRef, uiManagerRef) => {
            DOMElements = domElementsRef; AppState = appStateRef; DebugHelper = debugHelperRef; UIManager = uiManagerRef;
            DOMElements.aiChatNavLink.addEventListener('click', handleAIChatSelection);
            DOMElements.aiChatSendButton.addEventListener('click', handleAIChatSend);
            DOMElements.aiChatInput.addEventListener('keypress', (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleAIChatSend();}});
        },
        isChatActive: () => AppState && AppState.activeView === 'aiChat' && DOMElements.aiChatPane && !DOMElements.aiChatPane.classList.contains('hidden')
    };
})();