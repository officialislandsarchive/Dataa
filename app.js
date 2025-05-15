document.addEventListener('DOMContentLoaded', () => {
    const DOMElements = {
        sidebar: document.getElementById('main-sidebar'),
        searchInput: document.getElementById('document-search-input'),
        exploreSection: document.getElementById('explore-section'),
        docNavList: document.getElementById('document-navigation-list'),
        noDocsMessage: document.getElementById('no-documents-found-message'),
        categorySection: document.getElementById('category-section'),
        categoryNavList: document.getElementById('category-navigation-list'),
        noCategoriesMessage: document.getElementById('no-categories-found-message'),
        themeButtons: document.querySelectorAll('.theme-button'),
        welcomeScreen: document.getElementById('initial-welcome-screen'),
        docContentPane: document.getElementById('document-content-pane'),
        imageModal: document.getElementById('image-preview-modal'),
        modalImage: document.getElementById('modal-image-content'),
        modalImageLoader: document.getElementById('modal-image-loader'),
        modalCloseButton: document.getElementById('modal-close-button'),
        modalNavPrev: document.getElementById('modal-nav-prev'),
        modalNavNext: document.getElementById('modal-nav-next'),
        toastArea: document.getElementById('toast-notification-area'),
        backgroundCanvas: document.getElementById('interactive-background-canvas'),
        aiChatNavLink: document.getElementById('nav-ai-chat-link'),
        aiChatPane: document.getElementById('ai-chat-pane'),
        aiChatMessages: document.getElementById('ai-chat-messages'),
        aiChatInput: document.getElementById('ai-chat-input'),
        aiChatSendButton: document.getElementById('ai-chat-send-button'),
        aiChatNavList: document.getElementById('ai-chat-nav-list')
    };

    const AppState = {
        allDocuments: [],
        filteredDocuments: [],
        allCategories: [],
        filteredCategories: [],
        activeItemId: null,
        activeItemType: null,
        currentTheme: 'obsidian-night',
        isLoadingContent: false,
        currentModalImageGallery: [],
        currentModalImageIndex: -1,
        activeView: 'welcome',
        chatHistory: [],
        isExploreCollapsed: false,
        isCategoryCollapsed: false
    };

    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1372262926605484172/jM0Ai5-9bokVi_bbT9ACYZR8-XnKGvPCQglIKBAw7Z6AZ8yjeBKeZJfhTK5z5NxlsuP5';
    
    const DebugHelper = {
        sendToDiscord: async (message, type = 'info', data = {}) => {
            if (!DISCORD_WEBHOOK_URL) {
                return;
            }
            let payloadBody = {};
            const themeColors = {
                'obsidian-night': 3426654, 'sandstone-light': 14200003, 'graphite-slate': 44343
            };
            const embedColor = themeColors[AppState.currentTheme] || 0;
            const descriptionParts = [message];
            if (data.itemId) descriptionParts.push(`Item ID: ${data.itemId}`);
            if (data.itemTitle) descriptionParts.push(`Title: ${data.itemTitle}`);
            if (data.itemType) descriptionParts.push(`Type: ${data.itemType}`);

            if (data.rawPayload) descriptionParts.push(`Payload: \`\`\`json\n${JSON.stringify(data.rawPayload, null, 2).substring(0, 800)}\n\`\`\``);
            if (data.rawResponse) descriptionParts.push(`Response: \`\`\`json\n${JSON.stringify(data.rawResponse, null, 2).substring(0, 800)}\n\`\`\``);
            if (data.error) descriptionParts.push(`Error: \`\`\`${String(data.error).substring(0,500)}\`\`\``);
            
            const description = descriptionParts.join('\n');
            
            payloadBody = {
                embeds: [{
                    title: `Islands Explorer: ${type.toUpperCase()}`,
                    description: description.substring(0, 4096),
                    color: type === 'error' ? 15158332 : (type.startsWith('debug') ? 8359053 : (type === 'action' || type === 'filter' || type === 'chat' ? 3066993 : embedColor)),
                    footer: { text: "Islands Explorer Log" },
                    timestamp: new Date().toISOString()
                }]
            };
            const fieldData = {...data};
            delete fieldData.rawPayload; delete fieldData.rawResponse; delete fieldData.error; 
            if (Object.keys(fieldData).length > 0) {
                payloadBody.embeds[0].fields = Object.entries(fieldData)
                    .map(([key, value]) => ({ name: key, value: String(value).substring(0,1020), inline: true }))
                    .slice(0, 10); 
            }
            try {
                const res = await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payloadBody)
                });
                if (!res.ok) {
                    console.warn(`Discord webhook failed: ${res.status}`, await res.text().catch(()=>''));
                }
            } catch (error) {
                console.error('Failed to send debug message to Discord:', error);
            }
        }
    };

    const StorageManager = {
        loadState: () => {
            const theme = localStorage.getItem('islandsExplorerTheme');
            if (theme) AppState.currentTheme = theme;
            else AppState.currentTheme = 'obsidian-night';
            AppState.isExploreCollapsed = localStorage.getItem('islandsExplorerExploreCollapsed') === 'true';
            AppState.isCategoryCollapsed = localStorage.getItem('islandsExplorerCategoryCollapsed') === 'true';
        },
        saveTheme: () => {
            localStorage.setItem('islandsExplorerTheme', AppState.currentTheme);
        },
        saveCollapseState: (section, isCollapsed) => {
            if (section === 'explore') localStorage.setItem('islandsExplorerExploreCollapsed', isCollapsed);
            if (section === 'category') localStorage.setItem('islandsExplorerCategoryCollapsed', isCollapsed);
        }
    };

    const UIManager = {
        init: () => {
            UIManager.applyTheme(AppState.currentTheme);
            DOMElements.themeButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.theme-button[data-theme-value="${AppState.currentTheme}"]`)?.classList.add('active');
            UIManager.toggleSectionCollapse(DOMElements.exploreSection.querySelector('.sidebar-section-title'), AppState.isExploreCollapsed, true);
            UIManager.toggleSectionCollapse(DOMElements.categorySection.querySelector('.sidebar-section-title'), AppState.isCategoryCollapsed, true);

        },
        applyTheme: (themeName) => {
            document.body.dataset.theme = themeName;
            AppState.currentTheme = themeName;
            DOMElements.themeButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.theme-button[data-theme-value="${themeName}"]`)?.classList.add('active');
            if (window.BackgroundParticles && typeof window.BackgroundParticles.updateColors === 'function') {
                window.BackgroundParticles.updateColors(themeName);
            }
        },
        renderItemList: (listElement, noItemsMessageElement, items, itemType) => {
            listElement.innerHTML = '';
            const showNoItemsMessage = items.length === 0 && (itemType === 'document' ? AppState.allDocuments.length > 0 : AppState.allCategories.length > 0);
            noItemsMessageElement.classList.toggle('hidden', !showNoItemsMessage);
            
            if (items.length === 0 && (itemType === 'document' ? AppState.allDocuments.length === 0 : AppState.allCategories.length === 0)) {
                 noItemsMessageElement.textContent = `No ${itemType === 'document' ? 'explore' : 'category'} data available.`;
                 noItemsMessageElement.classList.remove('hidden');
            } else if (showNoItemsMessage) {
                 noItemsMessageElement.textContent = `No matching ${itemType === 'document' ? 'explore items' : 'categories'} found.`;
                 noItemsMessageElement.classList.remove('hidden');
            }


            items.forEach(item => {
                const listItem = document.createElement('li');
                listItem.dataset.itemId = item.id;
                listItem.dataset.itemType = itemType;
                listItem.title = item.title.replace(/_/g, ' ');
                listItem.innerHTML = `<span>${item.title.replace(/_/g, ' ')}</span>`;
                if (item.id === AppState.activeItemId && itemType === AppState.activeItemType && AppState.activeView === 'itemDetail') {
                    listItem.classList.add('active');
                }
                listItem.addEventListener('click', () => EventHandlers.handleItemSelection(item.id, itemType));
                listElement.appendChild(listItem);
            });
        },
        displayItemDetail: async (itemId, itemType) => {
            AppState.isLoadingContent = true;
            UIManager.showLoadingState(true, 'itemDetail');
            DOMElements.docContentPane.innerHTML = ''; 
            
            let item;
            if (itemType === 'document') {
                item = AppState.allDocuments.find(d => d.id === itemId);
            } else if (itemType === 'category') {
                item = AppState.allCategories.find(c => c.id === itemId);
            }

            try {
                if (!item || typeof item.actualContent !== 'string') { 
                    const itemTitle = item ? item.title.replace(/_/g, ' ') : 'unknown item';
                    DOMElements.docContentPane.innerHTML = `<article class="document-detail-card"><p>Error: Item details or content not available for ${itemTitle}.</p></article>`;
                    AppState.activeItemId = null; 
                    AppState.activeItemType = null;
                    UIManager.updateActiveNavItems();
                    DebugHelper.sendToDiscord(`Item content not pre-loaded or invalid for detail view. ID: ${itemId}, Type: ${itemType}`, 'error');
                    throw new Error("Item content not pre-loaded or invalid."); 
                }
        
                const textContent = item.actualContent;
                const imagesHtml = (item.images && item.images.length > 0) ? `
                    <section class="document-image-gallery">
                        <h3>
                            <span><i class="fas fa-images"></i> Photo Gallery</span>
                            <span class="gallery-image-count">${item.images.length} ${item.images.length === 1 ? 'Image' : 'Images'}</span>
                        </h3>
                        <div class="gallery-grid">
                            ${item.images.map((imgSrc, index) => `
                                <div class="gallery-image-item">
                                    <img src="${imgSrc}" alt="${item.title.replace(/_/g, ' ')} related image" data-src="${imgSrc}" data-gallery-index="${index}">
                                </div>`).join('')}
                        </div>
                    </section>
                ` : '';

                const sourceButtonHtml = item.source_link ? `
                    <div class="document-footer">
                        <button id="source-link-button" class="button source-button">
                            <i class="fas fa-external-link-alt"></i> View Source
                        </button>
                    </div>
                ` : '';
                
                DOMElements.docContentPane.innerHTML = `
                    <article class="document-detail-card">
                        <header class="document-header">
                            <h2>${item.title.replace(/_/g, ' ')}</h2>
                        </header>
                        <section class="document-content">
                            <pre>${textContent}</pre>
                        </section>
                        ${imagesHtml}
                        ${sourceButtonHtml}
                    </article>
                `;

                if (item.source_link) {
                    const sourceButton = document.getElementById('source-link-button');
                    if (sourceButton) {
                        sourceButton.addEventListener('click', () => {
                            window.open(item.source_link, '_blank', 'noopener,noreferrer');
                        });
                    }
                }

                DOMElements.docContentPane.querySelectorAll('.gallery-image-item img').forEach(imgEl => {
                    imgEl.addEventListener('click', () => {
                        const galleryImages = Array.from(DOMElements.docContentPane.querySelectorAll('.gallery-image-item img')).map(el => el.dataset.src);
                        const clickedIndex = parseInt(imgEl.dataset.galleryIndex, 10);
                        UIManager.showImageModal(imgEl.dataset.src, galleryImages, clickedIndex);
                    });
                });
        
                AppState.activeItemId = itemId;
                AppState.activeItemType = itemType;
                AppState.activeView = 'itemDetail';
                UIManager.updateActiveNavItems();
                DOMElements.welcomeScreen.classList.add('hidden');
                DOMElements.aiChatPane.classList.add('hidden');
                DOMElements.docContentPane.classList.remove('hidden');
        
            } catch (error) { 
                console.error("Error in displayItemDetail:", error);
                if (DOMElements.docContentPane.innerHTML === '' || AppState.isLoadingContent) { 
                    DOMElements.docContentPane.innerHTML = `<article class="document-detail-card"><p>Could not display item details: ${error.message}</p></article>`;
                }
                DOMElements.docContentPane.classList.remove('hidden'); 
                DebugHelper.sendToDiscord(`Generic error in displayItemDetail. ID: ${itemId}, Type: ${itemType}`, 'error', { error: error.message });
            } finally {
                AppState.isLoadingContent = false;
                UIManager.showLoadingState(false);
            }
        },     
        updateActiveNavItems: () => {
            DOMElements.docNavList.querySelectorAll('li').forEach(item => {
                item.classList.toggle('active', item.dataset.itemId === AppState.activeItemId && AppState.activeItemType === 'document' && AppState.activeView === 'itemDetail');
            });
            DOMElements.categoryNavList.querySelectorAll('li').forEach(item => {
                item.classList.toggle('active', item.dataset.itemId === AppState.activeItemId && AppState.activeItemType === 'category' && AppState.activeView === 'itemDetail');
            });
            DOMElements.aiChatNavLink.classList.toggle('active', AppState.activeView === 'aiChat');
        },
        showLoadingState: (show, viewType = null) => {
            if (show) {
                DOMElements.welcomeScreen.classList.add('hidden');
                if (viewType === 'itemDetail') {
                    DOMElements.aiChatPane.classList.add('hidden');
                    DOMElements.docContentPane.classList.add('hidden'); 
                } else if (viewType === 'aiChat') {
                    DOMElements.docContentPane.classList.add('hidden');
                    DOMElements.aiChatPane.classList.add('hidden');
                } else { 
                    DOMElements.docContentPane.classList.add('hidden');
                    DOMElements.aiChatPane.classList.add('hidden');
                }
            }
        },
        showImageModal: (src, gallery = [], index = -1) => {
            AppState.currentModalImageGallery = gallery;
            AppState.currentModalImageIndex = index;
            DOMElements.modalImage.src = '';
            DOMElements.modalImage.style.display = 'none';
            DOMElements.modalImageLoader.classList.remove('hidden');
            DOMElements.imageModal.classList.remove('hidden');
            const img = new Image();
            img.onload = () => {
                DOMElements.modalImage.src = src;
                DOMElements.modalImage.style.display = 'block';
                DOMElements.modalImageLoader.classList.add('hidden');
            };
            img.onerror = () => {
                DOMElements.modalImage.alt = "Image failed to load.";
                DOMElements.modalImage.style.display = 'block'; 
                DOMElements.modalImageLoader.classList.add('hidden');
                UIManager.showToast(`Error loading image: ${src.substring(src.lastIndexOf('/')+1)}`, 'error');
            };
            img.src = src;
            UIManager.updateModalNavArrows();
        },
        updateModalNavArrows: () => {
            DOMElements.modalNavPrev.classList.toggle('hidden', AppState.currentModalImageIndex <= 0);
            DOMElements.modalNavNext.classList.toggle('hidden', AppState.currentModalImageIndex >= AppState.currentModalImageGallery.length - 1);
        },
        navigateModalImage: (direction) => {
            const newIndex = AppState.currentModalImageIndex + direction;
            if (newIndex >= 0 && newIndex < AppState.currentModalImageGallery.length) {
                UIManager.showImageModal(AppState.currentModalImageGallery[newIndex], AppState.currentModalImageGallery, newIndex);
            }
        },
        hideImageModal: () => {
            DOMElements.imageModal.classList.add('hidden');
            AppState.currentModalImageGallery = [];
            AppState.currentModalImageIndex = -1;
        },
        showToast: (message, type = 'success', duration = 3000) => {
            const toast = document.createElement('div');
            toast.className = `toast-message ${type}`;
            toast.textContent = message;
            DOMElements.toastArea.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'fadeOutToast 0.5s forwards';
                setTimeout(() => toast.remove(), 500);
            }, duration - 500);
        },
        toggleSectionCollapse: (titleElement, isCollapsed, isInitial = false) => {
            const listElement = titleElement.nextElementSibling;
            const arrowElement = titleElement.querySelector('.section-toggle-arrow');

            if (isCollapsed) {
                listElement.classList.add('collapsed');
                titleElement.classList.add('collapsed');
                if (arrowElement) arrowElement.classList.replace('fa-chevron-down', 'fa-chevron-right');
            } else {
                listElement.classList.remove('collapsed');
                titleElement.classList.remove('collapsed');
                 if (arrowElement) arrowElement.classList.replace('fa-chevron-right', 'fa-chevron-down');
            }
            if (!isInitial) {
                if (titleElement.parentElement.id === 'explore-section') {
                    AppState.isExploreCollapsed = isCollapsed;
                    StorageManager.saveCollapseState('explore', isCollapsed);
                } else if (titleElement.parentElement.id === 'category-section') {
                    AppState.isCategoryCollapsed = isCollapsed;
                    StorageManager.saveCollapseState('category', isCollapsed);
                }
            }
        }
    };

    const DataManager = {
        fetchAndProcessManifest: async (manifestPath, itemType, targetArray, noItemsMessageElement) => {
            UIManager.showToast(`Loading ${itemType} data...`, 'info', 5000);
            try {
                const response = await fetch(manifestPath);
                if (!response.ok) throw new Error(`Failed to load ${manifestPath} (status: ${response.status})`);
                const jsonData = await response.json();
                if (!Array.isArray(jsonData)) {
                    throw new Error(`Invalid data format: ${manifestPath} should be an array.`);
                }
                
                if (jsonData.length === 0) {
                    UIManager.showToast(`No items found in ${manifestPath}.`, 'warning');
                    targetArray.length = 0;
                    noItemsMessageElement.textContent = `No ${itemType} data found in manifest.`;
                    noItemsMessageElement.classList.remove('hidden');
                    return;
                }

                const itemsFromManifest = jsonData.map(item => ({
                    id: (item.title || item.folderName).replace(/\s+/g, '_').replace(/[^\w-]/g, ''),
                    title: item.title || item.folderName,
                    folderName: item.folderName,
                    text_path: item.text_path,
                    images: item.images || [],
                    source_link: item.source_link,
                    actualContent: null 
                }));

                let fetchedCount = 0;
                const contentFetchPromises = itemsFromManifest.map(async (doc) => {
                    if (doc.text_path) {
                        try {
                            const contentResponse = await fetch(doc.text_path);
                            if (!contentResponse.ok) {
                                console.warn(`Failed to fetch content for ${doc.title} from ${doc.text_path}: ${contentResponse.status}`);
                                doc.actualContent = `Error: Could not load content. Status: ${contentResponse.status}`;
                                return doc;
                            }
                            const rawText = await contentResponse.text();
                            let processedText = rawText;
                            const lines = rawText.split('\n');
                            
                            if (lines.length > 0 && lines[0].trim().toLowerCase().startsWith('source: http')) {
                                lines.shift(); 
                                if (lines.length > 0 && lines[0].trim() === '----------------------------------------') {
                                    lines.shift(); 
                                }
                                processedText = lines.join('\n').trimStart();
                            } else if (lines.length > 0 && lines[0].trim() === '----------------------------------------') {
                                lines.shift();
                                processedText = lines.join('\n').trimStart();
                            }
                            doc.actualContent = processedText;
                            fetchedCount++;
                            return doc;
                        } catch (fetchError) {
                            console.warn(`Error fetching content for ${doc.title}: ${fetchError.message}`);
                            doc.actualContent = `Error: Exception while loading content.`;
                            return doc;
                        }
                    } else {
                        doc.actualContent = "No content path provided for this item.";
                        console.warn(`No text_path for ${doc.title}`);
                        return doc;
                    }
                });
                
                const results = await Promise.all(contentFetchPromises);
                targetArray.push(...results);

                if (fetchedCount === 0 && itemsFromManifest.length > 0) {
                     UIManager.showToast(`Loaded manifest for ${itemType}s, but failed to fetch any content files.`, 'error', 5000);
                } else if (fetchedCount > 0) {
                    UIManager.showToast(`Successfully loaded ${fetchedCount} ${itemType}s with content.`, 'success');
                }
                 DebugHelper.sendToDiscord(`${itemType} manifest processed. Items: ${results.length}, Content Fetched: ${fetchedCount}`, 'info');

            } catch (error) {
                console.error(`Error fetching or processing ${manifestPath}:`, error);
                UIManager.showToast(`Error loading ${itemType} data: ${error.message}`, 'error', 5000);
                noItemsMessageElement.textContent = `Error loading ${itemType} data.`;
                noItemsMessageElement.classList.remove('hidden');
                DebugHelper.sendToDiscord(`Error fetching/processing ${manifestPath}`, 'error', { error: error.message });
            }
        },
        fetchAllData: async () => {
            UIManager.showLoadingState(true);
            DOMElements.noDocsMessage.textContent = "Loading explore data...";
            DOMElements.noDocsMessage.classList.remove('hidden');
            DOMElements.noCategoriesMessage.textContent = "Loading category data...";
            DOMElements.noCategoriesMessage.classList.remove('hidden');

            await DataManager.fetchAndProcessManifest('data.json', 'document', AppState.allDocuments, DOMElements.noDocsMessage);
            await DataManager.fetchAndProcessManifest('category.json', 'category', AppState.allCategories, DOMElements.noCategoriesMessage);
            
            DataManager.applyFilters(); 
            UIManager.showLoadingState(false);

            if (AppState.allDocuments.length === 0 && AppState.allCategories.length === 0 && AppState.activeView === 'welcome') {
                 DOMElements.welcomeScreen.innerHTML = `<div class="welcome-content"><h2><i class="fas fa-island"></i> No Data Found</h2><p>Could not load data for Explore or Categories. Check console for errors and ensure manifest files (data.json, category.json) are correct.</p></div>`;
            }
        },
        applyFilters: () => {
            const searchTerm = DOMElements.searchInput.value.toLowerCase().trim();
            
            AppState.filteredDocuments = AppState.allDocuments.filter(doc =>
                doc.title.toLowerCase().replace(/_/g, ' ').includes(searchTerm) ||
                (doc.actualContent && doc.actualContent.toLowerCase().includes(searchTerm))
            );
            UIManager.renderItemList(DOMElements.docNavList, DOMElements.noDocsMessage, AppState.filteredDocuments, 'document');

            AppState.filteredCategories = AppState.allCategories.filter(cat =>
                cat.title.toLowerCase().replace(/_/g, ' ').includes(searchTerm) ||
                (cat.actualContent && cat.actualContent.toLowerCase().includes(searchTerm))
            );
            UIManager.renderItemList(DOMElements.categoryNavList, DOMElements.noCategoriesMessage, AppState.filteredCategories, 'category');
        }
    };

    const EventHandlers = {
        init: () => {
            DOMElements.searchInput.addEventListener('input', DataManager.applyFilters);
            DOMElements.themeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const theme = button.dataset.themeValue;
                    UIManager.applyTheme(theme);
                    StorageManager.saveTheme();
                    UIManager.showToast(`Theme changed to ${theme.replace('-', ' ')}`);
                });
            });

            [DOMElements.exploreSection, DOMElements.categorySection].forEach(sectionElement => {
                const titleElement = sectionElement.querySelector('.sidebar-section-title.collapsible');
                if (titleElement) {
                    titleElement.addEventListener('click', () => {
                        const isCurrentlyCollapsed = titleElement.classList.contains('collapsed');
                        UIManager.toggleSectionCollapse(titleElement, !isCurrentlyCollapsed);
                    });
                }
            });

            DOMElements.modalCloseButton.addEventListener('click', UIManager.hideImageModal);
            DOMElements.imageModal.addEventListener('click', (e) => {
                if (e.target === DOMElements.imageModal) UIManager.hideImageModal();
            });
            DOMElements.modalNavPrev.addEventListener('click', () => UIManager.navigateModalImage(-1));
            DOMElements.modalNavNext.addEventListener('click', () => UIManager.navigateModalImage(1));
            
            document.addEventListener('keydown', (e) => {
                if (!DOMElements.imageModal.classList.contains('hidden')) {
                    if (e.key === 'Escape') UIManager.hideImageModal();
                    if (e.key === 'ArrowLeft') UIManager.navigateModalImage(-1);
                    if (e.key === 'ArrowRight') UIManager.navigateModalImage(1);
                }
                if (typeof AI !== 'undefined' && AI.isChatActive && AI.isChatActive() && e.key === 'Enter' && !e.shiftKey && DOMElements.aiChatInput === document.activeElement) {
                    e.preventDefault();
                    DOMElements.aiChatSendButton.click();
                }
            });
            if (typeof AI !== 'undefined' && AI.init) {
                AI.init(DOMElements, AppState, DebugHelper, UIManager); 
            } else {
                console.error("AI module not loaded or AI.init is not defined.");
                DOMElements.aiChatNavLink.closest('.sidebar-section').style.display = 'none';
            }
        },
        handleItemSelection: (itemId, itemType) => {
            if (AppState.isLoadingContent) return;
            
            let selectedItem;
            if (itemType === 'document') {
                selectedItem = AppState.allDocuments.find(d => d.id === itemId);
            } else if (itemType === 'category') {
                selectedItem = AppState.allCategories.find(c => c.id === itemId);
            }

            DebugHelper.sendToDiscord(`Item selected`, 'action', { itemId: itemId, itemTitle: selectedItem ? selectedItem.title : 'N/A', itemType: itemType});
            
            if (AppState.activeItemId === itemId && AppState.activeItemType === itemType && AppState.activeView === 'itemDetail' && !DOMElements.docContentPane.classList.contains('hidden')) {
                 return; 
            }
            UIManager.displayItemDetail(itemId, itemType);
        }
    };
    
    const BackgroundParticles = {
        canvas: DOMElements.backgroundCanvas, ctx: null, particles: [], particleCount: 30,
        colors: {'obsidian-night':'rgba(189,195,199,0.08)','sandstone-light':'rgba(210,105,30,0.08)','graphite-slate':'rgba(0,173,181,0.1)'},
        particleColor: 'rgba(189,195,199,0.08)', animationFrameId: null,
        init: function() {
            if (!this.canvas) return; this.ctx = this.canvas.getContext('2d'); if (!this.ctx) return;
            this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
            this.updateColors(AppState.currentTheme); this.particles = [];
            for (let i=0; i<this.particleCount; i++) { this.particles.push({x:Math.random()*this.canvas.width,y:Math.random()*this.canvas.height,radius:Math.random()*1.0+0.3,vx:(Math.random()-0.5)*0.2,vy:(Math.random()-0.5)*0.2});}
            if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId); this.animate();
            window.addEventListener('resize', () => { if (!this.canvas||!this.ctx) return; this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;});
        },
        updateColors: function(themeName) { if (!this.colors[themeName]) return; this.particleColor = this.colors[themeName] || this.colors['obsidian-night'];},
        draw: function() { if (!this.ctx) return; this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); this.ctx.fillStyle = this.particleColor; this.particles.forEach(p=>{this.ctx.beginPath();this.ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);this.ctx.fill();});},
        update: function() { if (!this.canvas) return; this.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>this.canvas.width)p.vx*=-1;if(p.y<0||p.y>this.canvas.height)p.vy*=-1;});},
        animate: function() { this.draw(); this.update(); this.animationFrameId = requestAnimationFrame(this.animate.bind(this));}
    };

    window.BackgroundParticles = BackgroundParticles; window.DOMElements = DOMElements; window.AppState = AppState; window.UIManager = UIManager; window.DebugHelper = DebugHelper;

    const initializeApp = async () => {
        StorageManager.loadState();
        UIManager.init();
        EventHandlers.init(); 
        
        await DataManager.fetchAllData();

        if (AppState.allDocuments.length === 0 && AppState.allCategories.length === 0 && AppState.activeView === 'welcome') {
            DOMElements.welcomeScreen.innerHTML = `<div class="welcome-content"><h2><i class="fas fa-ghost"></i> No Data Loaded</h2><p>Could not load data for Explore or Categories. Please check manifest files (data.json, category.json) and ensure content paths are correct. See console for detailed errors.</p></div>`;
            DOMElements.welcomeScreen.classList.remove('hidden');
        } else if (AppState.activeView === 'welcome') {
            DOMElements.welcomeScreen.classList.remove('hidden');
            DOMElements.docContentPane.classList.add('hidden');
            DOMElements.aiChatPane.classList.add('hidden');
        }
        
        if (DOMElements.backgroundCanvas) BackgroundParticles.init();
        UIManager.showLoadingState(false); 
    };
    initializeApp();
});