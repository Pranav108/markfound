// Initialize Mermaid with GitHub-like dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        darkMode: true,
        background: '#0d1117',
        primaryColor: '#238636',
        primaryTextColor: '#c9d1d9',
        primaryBorderColor: '#30363d',
        lineColor: '#238636',
        secondaryColor: '#161b22',
        tertiaryColor: '#0d1117'
    }
});

// DOM Elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const separator = document.getElementById('separator');
const editorPanel = document.getElementById('editorPanel');
const fullscreenBtn = document.getElementById('fullscreenBtn');

let isFullscreen = false;
let mermaidCounter = 0;

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helper function to decode HTML entities
function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Render markdown with mermaid support
async function renderMarkdown(text) {
    // Configure marked options
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
    });

    // Convert markdown to HTML
    let html = marked.parse(text);

    // Replace mermaid code blocks with placeholders
    const mermaidBlocks = [];
    html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        const id = `mermaid-${mermaidCounter++}`;
        // Decode HTML entities before passing to Mermaid
        const decodedCode = decodeHtml(code.trim());
        mermaidBlocks.push({ id, code: decodedCode });
        return `<div class="mermaid" id="${id}"></div>`;
    });

    // Set HTML
    preview.innerHTML = html;

// Render mermaid diagrams with expand button
for (const block of mermaidBlocks) {
try {
    const element = document.getElementById(block.id);
    if (element) {
        const { svg } = await mermaid.render(`mermaid-svg-${block.id}`, block.code);
        
        // Create container with expand button
        const container = document.createElement('div');
        container.className = 'mermaid-container';
        
        const expandBtn = document.createElement('button');
        expandBtn.className = 'mermaid-expand-btn';
        expandBtn.innerHTML = '⛶';
        expandBtn.title = 'Expand diagram';
        expandBtn.onclick = () => openMermaidModal(svg, block.code);
        
        container.innerHTML = svg;
        container.appendChild(expandBtn);
        
        element.parentNode.replaceChild(container, element);
    }
} catch (error) {
    console.error('Mermaid rendering error:', error);
    const element = document.getElementById(block.id);
    if (element) {
        element.innerHTML = `<pre style="color: #ff6b6b;">Error rendering diagram: ${error.message}</pre>`;
    }
}
}
}

// Update preview with debouncing
const updatePreview = debounce((text) => {
    renderMarkdown(text);
}, 300);

// Editor input handler
editor.addEventListener('input', (e) => {
    updatePreview(e.target.value);
});

// Drag functionality for resizable separator
let isDragging = false;
let startX = 0;
let startWidth = 0;
let containerWidth = 0;

separator.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = editorPanel.offsetWidth;
    containerWidth = document.querySelector('.container').offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging || isFullscreen) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;
    
    // Set minimum and maximum widths (20% to 80%)
    const minWidth = containerWidth * 0.2;
    const maxWidth = containerWidth * 0.8;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
        const percentage = (newWidth / containerWidth) * 100;
        editorPanel.style.flex = `0 0 ${percentage}%`;
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

// Fullscreen toggle functionality
let savedFlex = '';

fullscreenBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    
    if (isFullscreen) {
        // Save current flex value before hiding
        savedFlex = editorPanel.style.flex || '0 0 30%';
        // Completely hide the editor panel
        editorPanel.style.display = 'none';
        separator.style.display = 'none';
        fullscreenBtn.innerHTML = '◧';
        fullscreenBtn.title = 'Exit fullscreen';
    } else {
        // Restore display and flex value
        editorPanel.style.display = 'flex';
        editorPanel.style.flex = savedFlex;
        separator.style.display = 'block';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = 'Preview fullscreen';
    }
});

// Mermaid Modal Functionality
let currentZoom = 1;
let baseZoom = 1; // The auto-calculated scale that represents 100%
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let translateX = 0;
let translateY = 0;
let currentTranslateX = 0;
let currentTranslateY = 0;

function openMermaidModal(svgContent, mermaidCode) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('mermaidModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mermaidModal';
        modal.className = 'mermaid-modal';
        modal.innerHTML = `
            <div class="mermaid-modal-content">
                <div class="mermaid-modal-header">
                    <div class="mermaid-modal-title">Mermaid Diagram Viewer</div>
                    <div class="mermaid-modal-controls">
                        <div class="zoom-control">
                            <button class="zoom-btn" id="zoomOut" title="Zoom out">−</button>
                            <span class="zoom-level" id="zoomLevel">100%</span>
                            <button class="zoom-btn" id="zoomIn" title="Zoom in">+</button>
                        </div>
                        <button class="modal-close-btn" id="modalClose" title="Close viewer">✕</button>
                    </div>
                </div>
                <div class="mermaid-modal-body" id="modalBody">
                    <div class="mermaid-modal-diagram" id="modalDiagram"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('modalClose').addEventListener('click', closeMermaidModal);
        document.getElementById('zoomIn').addEventListener('click', () => zoomDiagram(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => zoomDiagram(-0.1));
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeMermaidModal();
        });
        
        // Pan functionality - on diagram itself
        const diagram = document.getElementById('modalDiagram');
        diagram.addEventListener('mousedown', startPan);
        document.addEventListener('mousemove', doPan);
        document.addEventListener('mouseup', endPan);
        
        // Mouse wheel zoom on modal body
        const modalBody = document.getElementById('modalBody');
        modalBody.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            zoomDiagram(delta);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleModalKeyboard);
    }
    
    // Set content and show modal
    const diagram = document.getElementById('modalDiagram');
    diagram.innerHTML = svgContent;
    
    // Show modal first to get accurate measurements
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Calculate base zoom to fill screen, which will be displayed as "100%"
    setTimeout(() => {
        const svg = diagram.querySelector('svg');
        const modalBody = document.getElementById('modalBody');
        
        if (svg && modalBody) {
            const svgWidth = svg.width.baseVal.value || svg.getBoundingClientRect().width;
            const svgHeight = svg.height.baseVal.value || svg.getBoundingClientRect().height;
            const containerWidth = modalBody.clientWidth;
            const containerHeight = modalBody.clientHeight;
            
            // Calculate scale to fit with 85% of available space
            const scaleX = (containerWidth * 0.85) / svgWidth;
            const scaleY = (containerHeight * 0.85) / svgHeight;
            
            // Use the smaller scale to ensure it fits both dimensions
            baseZoom = Math.min(scaleX, scaleY, 5); // Cap at 5x max
            baseZoom = Math.max(baseZoom, 0.5); // Min 0.5x
        } else {
            baseZoom = 1;
        }
        
        // Start at 100% (which is the auto-calculated baseZoom)
        currentZoom = 1;
        currentTranslateX = 0;
        currentTranslateY = 0;
        updateDiagramTransform();
        updateZoomDisplay();
    }, 100);
}

function closeMermaidModal() {
    const modal = document.getElementById('mermaidModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentZoom = 1;
        currentTranslateX = 0;
        currentTranslateY = 0;
    }
    document.removeEventListener('keydown', handleModalKeyboard);
    document.removeEventListener('mousemove', doPan);
    document.removeEventListener('mouseup', endPan);
}

function zoomDiagram(delta) {
    // Controlled zoom speed (0.05 to 0.1 per step)
    currentZoom += delta;
    currentZoom = Math.max(0.5, Math.min(currentZoom, 5)); // Limit between 50% and 500%
    
    updateDiagramTransform();
    updateZoomDisplay();
}

function updateDiagramTransform() {
    const diagram = document.getElementById('modalDiagram');
    if (diagram) {
        // Apply both baseZoom and currentZoom
        const totalZoom = baseZoom * currentZoom;
        diagram.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${totalZoom})`;
    }
}

function updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoomLevel');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    }
}

function startPan(e) {
    if (e.target.closest('.mermaid-modal-header')) return;
    
    isPanning = true;
    startPanX = e.clientX;
    startPanY = e.clientY;
    translateX = currentTranslateX;
    translateY = currentTranslateY;
    e.preventDefault();
}

function doPan(e) {
    if (!isPanning) return;
    e.preventDefault();
    
    const deltaX = e.clientX - startPanX;
    const deltaY = e.clientY - startPanY;
    
    currentTranslateX = translateX + deltaX;
    currentTranslateY = translateY + deltaY;
    
    updateDiagramTransform();
}

function endPan() {
    isPanning = false;
}

function handleModalKeyboard(e) {
    const modal = document.getElementById('mermaidModal');
    if (!modal || !modal.classList.contains('active')) return;
    
    switch(e.key) {
        case 'Escape':
            closeMermaidModal();
            break;
        case '+':
        case '=':
            zoomDiagram(0.1);
            break;
        case '-':
        case '_':
            zoomDiagram(-0.1);
            break;
    }
}

// Initial render - wait for libraries to load
window.addEventListener('load', () => {
    renderMarkdown(editor.value);
});
