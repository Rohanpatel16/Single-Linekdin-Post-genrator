import { GoogleGenAI, Modality, Type } from "@google/genai";

interface PostContent {
  image_prompt: string;
  header_text: string;
  subheader_text: string;
}

// --- Global State ---
let ai: GoogleGenAI;
let currentPostOptions: PostContent[] | null = null;
let selectedImageIndex = 0;
let imageGenerations: Map<number, { versions: string[], currentIndex: number }> = new Map();


// --- Main form elements ---
const form = document.getElementById('idea-form') as HTMLFormElement;
const ideaInput = document.getElementById('idea-input') as HTMLInputElement;
const watermarkInput = document.getElementById('watermark-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-container') as HTMLDivElement;
const loadingText = document.getElementById('loading-text') as HTMLParagraphElement;

// --- Output elements ---
const outputContainer = document.getElementById('results-container') as HTMLDivElement;
const captionContainer = document.getElementById('caption-container') as HTMLDivElement;
const postOptionsGrid = document.getElementById('post-options-grid') as HTMLDivElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;
const savePdfButton = document.getElementById('save-pdf-button') as HTMLButtonElement;
const captionTextEl = document.getElementById('caption-text') as HTMLDivElement;
const captionLoader = document.getElementById('caption-loader') as HTMLDivElement;
const imagePreviewContainer = document.getElementById('image-preview-container') as HTMLDivElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;

// --- Preview Controls ---
const previewNavControls = document.querySelector('.preview-nav-controls') as HTMLDivElement;
const previewPrevBtn = document.getElementById('preview-prev-btn') as HTMLButtonElement;
const previewNextBtn = document.getElementById('preview-next-btn') as HTMLButtonElement;
const previewRegenBtn = document.getElementById('preview-regen-btn') as HTMLButtonElement;
const previewDownloadBtn = document.getElementById('preview-download-btn') as HTMLButtonElement;
const previewPromptBtn = document.getElementById('preview-prompt-btn') as HTMLButtonElement;

// --- Prompt Modal Elements ---
const promptModalOverlay = document.getElementById('prompt-modal-overlay') as HTMLDivElement;
const closePromptButton = document.getElementById('close-prompt-button') as HTMLButtonElement;
const promptModalHeaderInput = document.getElementById('prompt-modal-header-input') as HTMLInputElement;
const promptModalSubheaderInput = document.getElementById('prompt-modal-subheader-input') as HTMLInputElement;
const promptModalImagePromptInput = document.getElementById('prompt-modal-image-prompt-input') as HTMLTextAreaElement;
const regenerateWithPromptButton = document.getElementById('regenerate-with-prompt-button') as HTMLButtonElement;


// --- Settings Modal Elements ---
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const settingsModalOverlay = document.getElementById('settings-modal-overlay') as HTMLDivElement;
const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('save-settings-button') as HTMLButtonElement;
const resetSettingsButton = document.getElementById('reset-settings-button') as HTMLButtonElement;
const imagePromptInput = document.getElementById('image-prompt-input') as HTMLTextAreaElement;
const captionPromptInput = document.getElementById('caption-prompt-input') as HTMLTextAreaElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;

// --- Default Settings ---
const DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert Viral Instagram Post creator and art director. Your role is to generate the complete content for 5 DISTINCT post options.

**Your Primary Goal: CREATE 5 SCROLL-STOPPING IMAGE CONCEPTS**
You must conceptualize five unique, visually striking image options. For each option, you must define:
- **Color Palette:** A cohesive set of colors (e.g., "vibrant pastels," "monochromatic black and white").
- **Style:** A consistent artistic style (e.g., "minimalist line art," "glossy 3D render," "cinematic photorealistic").
- **Composition:** A clear focal point and layout that leaves space for text.
- **Tone:** A specific mood (e.g., "inspirational and uplifting," "bold and energetic").

**Your Task:**
1.  Receive a topic from the user.
2.  Brainstorm 5 DIVERSE visual themes (colors, styles, tones, compositions).
3.  Generate an array of 5 JSON objects. Each object must contain:
    a.  \`image_prompt\`: A visually descriptive prompt for the AI image generator, incorporating the theme.
    b.  \`header_text\`: A short, punchy headline to be overlaid on the image.
    c.  \`subheader_text\`: A brief explanatory sub-headline or call-to-action for the image.

**Rules for Output:**
-   Return a single JSON array.
-   The JSON array must contain exactly 5 objects.
-   Each object must have three string keys: "image_prompt", "header_text", and "subheader_text".
-   Ensure the 5 options are significantly different from each other.

---
**## Example Application ##**

**If the User Topic is:** "The importance of daily hydration"

**Your JSON Output for that Example:**
[
  {
    "image_prompt": "A hyper-realistic, glossy 3D render of a crystal clear glass of water with sparkling condensation droplets. An orange slice rests on the rim. The background is a clean, minimalist gradient of cool blue to white.",
    "header_text": "DRINK MORE WATER",
    "subheader_text": "Your body will thank you."
  },
  {
    "image_prompt": "Minimalist line art illustration of a stylized water droplet character running a marathon. The color palette is simple two-tone blue on an off-white background.",
    "header_text": "FUEL YOUR GOALS",
    "subheader_text": "Hydration is key."
  },
  {
    "image_prompt": "A dramatic, cinematic photo of a person's hand reaching for a bottle of water in a desert. The lighting is golden hour, casting long shadows. Focus is on the bottle.",
    "header_text": "QUENCH YOUR THIRST",
    "subheader_text": "Don't wait until it's too late."
  },
  {
    "image_prompt": "A vibrant, colorful flat-lay composition of various fruits and vegetables known for high water content (watermelon, cucumber, strawberries) arranged in a beautiful pattern.",
    "header_text": "EAT YOUR WATER",
    "subheader_text": "Hydration comes from food too."
  },
  {
    "image_prompt": "A sleek, futuristic infographic design showing the human body with glowing blue lines indicating water flow and statistics about hydration benefits. Dark mode, neon blue and white text.",
    "header_text": "UNLOCK PEAK PERFORMANCE",
    "subheader_text": "It all starts with H2O."
  }
]
---`;
const DEFAULT_CAPTION_SYSTEM_INSTRUCTION = `You are a world-class Instagram copywriter. Your goal is to write a viral, engaging caption for a single image post.
You will be given the content of the post.
Your caption MUST:
-   Be between 50-150 words.
-   Start with a strong, scroll-stopping hook.
-   Provide value and context for the image.
-   End with a clear call-to-action (e.g., asking a question, asking to save/share).
-   Include 5-10 relevant, high-traffic hashtags.
-   Have a professional yet conversational tone.
-   Be formatted with line breaks for readability.`;


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    loadSettings();
});

form.addEventListener('submit', handleSubmit);
copyButton.addEventListener('click', handleCopyCaption);
savePdfButton.addEventListener('click', handleSaveAsPdf);

// Preview Controls Listeners
previewPrevBtn.addEventListener('click', (e) => handleNavigateVersion(e, selectedImageIndex, -1));
previewNextBtn.addEventListener('click', (e) => handleNavigateVersion(e, selectedImageIndex, 1));
previewRegenBtn.addEventListener('click', (e) => handleRegenerateImage(e, selectedImageIndex));
previewDownloadBtn.addEventListener('click', handlePreviewDownload);
previewPromptBtn.addEventListener('click', handleShowPrompt);

// Prompt Modal Listeners
closePromptButton.addEventListener('click', closePromptModal);
promptModalOverlay.addEventListener('click', (e) => {
    if (e.target === promptModalOverlay) {
        closePromptModal();
    }
});
regenerateWithPromptButton.addEventListener('click', handleRegenerateWithEditedPrompt);


// Settings Modal Listeners
settingsButton.addEventListener('click', openSettings);
closeSettingsButton.addEventListener('click', closeSettings);
settingsModalOverlay.addEventListener('click', (e) => {
    if (e.target === settingsModalOverlay) {
        closeSettings();
    }
});
saveSettingsButton.addEventListener('click', saveSettings);
resetSettingsButton.addEventListener('click', resetSettingsToDefaults);
temperatureSlider.addEventListener('input', () => {
    temperatureValue.textContent = temperatureSlider.value;
});

// --- Main Functions ---
async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!ideaInput.value.trim()) {
        alert("Please enter a topic or idea.");
        return;
    }

    // Reset state and UI for a new generation
    currentPostOptions = null;
    selectedImageIndex = 0;
    imageGenerations.clear();
    outputContainer.classList.add('hidden');
    imagePreviewContainer.classList.add('hidden');
    copyButton.disabled = true;
    savePdfButton.disabled = true;

    try {
        setLoadingState(true, 'Step 1/3: Crafting 5 viral concepts...');
        const postContentArray = await generatePostContent(ideaInput.value);
        currentPostOptions = postContentArray;

        setupImagePlaceholders();

        loadingText.textContent = 'Step 2/3: Generating your stunning visuals...';
        const imagePromises = currentPostOptions.map((content, index) => generateImage(content, index));
        const captionPromise = generateCaption(currentPostOptions[0]); // Pre-generate caption for the first image

        const [caption] = await Promise.all([captionPromise, ...imagePromises]);
        
        loadingText.textContent = 'Step 3/3: Finalizing the post...';
        displayCaption(caption);
        outputContainer.classList.remove('hidden');
        copyButton.disabled = false;
        savePdfButton.disabled = false;


    } catch (error) {
        console.error("An error occurred:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        setLoadingState(false);
    }
}


// --- API Call Functions ---
async function generatePostContent(topic: string): Promise<PostContent[]> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Apply the framework to this topic: "${topic}"`,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_prompt: { type: Type.STRING },
                        header_text: { type: Type.STRING },
                        subheader_text: { type: Type.STRING },
                    },
                    required: ['image_prompt', 'header_text', 'subheader_text'],
                }
            },
        },
    });
    const json = JSON.parse(response.text);
    if (!Array.isArray(json) || json.length === 0) {
        throw new Error("AI failed to generate post content options.");
    }
    return json;
}

async function generateCaption(postContent: PostContent): Promise<string> {
    const promptText = `Post Content:\n- Visuals: ${postContent.image_prompt}\n- Text: "${postContent.header_text} - ${postContent.subheader_text}"`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: promptText,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION,
        },
    });
    return response.text.trim();
}

async function generateImage(postContent: PostContent, index: number): Promise<void> {
     const combinedPrompt = `${postContent.image_prompt}. The image must prominently feature the following text, styled beautifully and legibly. Header: "${postContent.header_text}". Subheader: "${postContent.subheader_text}".`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: combinedPrompt }]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
            const base64Image = response.candidates[0].content.parts[0].inlineData.data;
            displayImage(base64Image, index);
        } else {
            console.error(`No image data received for option ${index + 1}.`);
            displayError(`No image data`, index);
        }
    } catch (error) {
        console.error(`Error generating image ${index + 1}:`, error);
        displayError('API Error', index);
    }
}


// --- UI Functions ---
function setLoadingState(isLoading: boolean, message: string = '') {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = message;
        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
    } else {
        loadingIndicator.classList.add('hidden');
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
    }
}

function displayCaption(caption: string) {
    // Basic markdown-to-HTML conversion
    let html = caption.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    captionTextEl.innerHTML = html;
}

function setupImagePlaceholders() {
    postOptionsGrid.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'post-image-wrapper loading-placeholder';
        placeholder.dataset.index = i.toString();
        placeholder.innerHTML = `<div class="spinner"></div><span>Option ${i+1}</span>`;
        placeholder.addEventListener('click', () => handleImageSelect(i));
        postOptionsGrid.appendChild(placeholder);
    }
    // Select the first one by default
    postOptionsGrid.children[0]?.classList.add('selected');
}

function renderImageThumbnail(index: number) {
    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`) as HTMLDivElement;
    const imageData = imageGenerations.get(index);

    if (!container || !imageData || !currentPostOptions) return;

    container.innerHTML = ''; // Clear spinner/previous content
    container.classList.remove('loading-placeholder');

    const { versions, currentIndex } = imageData;
    const currentImageSrc = versions[currentIndex];

    // Add image
    const img = document.createElement('img');
    img.src = currentImageSrc;
    img.alt = `Generated image for: ${currentPostOptions?.[index]?.header_text}`;
    container.appendChild(img);

    // Add overlay with controls
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';

    // Add navigation if multiple versions exist
    if (versions.length > 1) {
        const nav = document.createElement('div');
        nav.className = 'thumbnail-nav';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-btn';
        prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        prevBtn.addEventListener('click', (e) => handleNavigateVersion(e, index, -1));

        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-btn';
        nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        nextBtn.addEventListener('click', (e) => handleNavigateVersion(e, index, 1));
        
        nav.appendChild(prevBtn);
        nav.appendChild(nextBtn);
        overlay.appendChild(nav);
        
        const versionCounter = document.createElement('div');
        versionCounter.className = 'version-counter';
        versionCounter.textContent = `${currentIndex + 1} / ${versions.length}`;
        container.appendChild(versionCounter);
    }
    
    container.appendChild(overlay);

    // If this is the first image, set it as the initial preview
    if (index === 0 && versions.length === 1) {
        updateImagePreview(img.src, img.alt, index);
    }
}

function displayImage(base64Image: string, index: number) {
    const watermarkText = watermarkInput.value.trim();
    const originalSrc = `data:image/png;base64,${base64Image}`;

    const processAndRender = (imageSrc: string) => {
        if (!imageGenerations.has(index)) {
            imageGenerations.set(index, { versions: [], currentIndex: -1 });
        }
        const imageData = imageGenerations.get(index)!;
        imageData.versions.push(imageSrc);
        imageData.currentIndex = imageData.versions.length - 1;
        
        const container = postOptionsGrid.querySelector(`[data-index="${index}"]`);
        container?.querySelector('.thumbnail-loader')?.remove();

        renderImageThumbnail(index);
    };

    if (!watermarkText) {
        processAndRender(originalSrc);
    } else {
        const sourceImage = new Image();
        sourceImage.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const targetSize = 1080;
            canvas.width = targetSize;
            canvas.height = targetSize;

            if (!ctx) {
                console.error("Canvas context not available, rendering image without watermark.");
                processAndRender(originalSrc);
                return;
            }

            ctx.drawImage(sourceImage, 0, 0, targetSize, targetSize);
            const fontSize = targetSize * 0.025;
            ctx.font = `600 ${fontSize}px Inter, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            const padding = targetSize * 0.02;
            ctx.fillText(watermarkText, canvas.width - padding, canvas.height - padding);

            const watermarkedSrc = canvas.toDataURL('image/png');
            processAndRender(watermarkedSrc);
        };
        sourceImage.onerror = () => {
            console.error(`Failed to load image for watermarking at index ${index}.`);
            displayError('Image Load Error', index);
        };
        sourceImage.src = originalSrc;
    }
}

function displayError(message: string, index: number) {
    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`);
    if (container) {
        container.classList.remove('loading-placeholder');
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

function updateImagePreview(src: string, alt: string, index: number) {
    if (previewImage && imagePreviewContainer) {
        previewImage.src = src;
        previewImage.alt = alt.replace('Generated image for:', 'Preview for:');
        imagePreviewContainer.classList.remove('hidden');

        // Update preview controls visibility
        const imageData = imageGenerations.get(index);
        if (imageData && imageData.versions.length > 1) {
            previewNavControls.classList.remove('hidden');
        } else {
            previewNavControls.classList.add('hidden');
        }
    }
}

async function handleImageSelect(index: number) {
    if (index === selectedImageIndex || !currentPostOptions) return;

    // Update selected state
    const previouslySelected = postOptionsGrid.querySelector(`[data-index="${selectedImageIndex}"]`);
    previouslySelected?.classList.remove('selected');
    const newlySelected = postOptionsGrid.querySelector(`[data-index="${index}"]`);
    newlySelected?.classList.add('selected');
    
    // Update the main preview image
    const imageData = imageGenerations.get(index);
    if (imageData) {
        const currentImageSrc = imageData.versions[imageData.currentIndex];
        updateImagePreview(currentImageSrc, `Generated image for: ${currentPostOptions[index].header_text}`, index);
    } else {
        imagePreviewContainer.classList.add('hidden');
    }

    selectedImageIndex = index;

    // Fetch new caption
    captionLoader.classList.remove('hidden');
    copyButton.disabled = true;
    savePdfButton.disabled = true;
    try {
        const newCaption = await generateCaption(currentPostOptions[index]);
        displayCaption(newCaption);
    } catch (error) {
        captionTextEl.innerHTML = `<span class="error-message">Failed to generate caption.</span>`;
        console.error("Failed to generate new caption:", error);
    } finally {
        captionLoader.classList.add('hidden');
        copyButton.disabled = false;
        savePdfButton.disabled = false;
    }
}

async function handleRegenerateImage(e: MouseEvent, index: number) {
    e.stopPropagation();
    if (!currentPostOptions) return;

    const container = postOptionsGrid.querySelector(`[data-index="${index}"]`) as HTMLDivElement;
    if (container) {
        const loader = document.createElement('div');
        loader.className = 'thumbnail-loader';
        loader.innerHTML = `<div class="spinner"></div>`;
        container.appendChild(loader);
    }

    await generateImage(currentPostOptions[index], index);
}

function handleNavigateVersion(e: MouseEvent, index: number, direction: number) {
    e.stopPropagation();
    const imageData = imageGenerations.get(index);
    if (!imageData || !currentPostOptions) return;

    let newIndex = imageData.currentIndex + direction;
    if (newIndex < 0) newIndex = imageData.versions.length - 1;
    if (newIndex >= imageData.versions.length) newIndex = 0;
    
    imageData.currentIndex = newIndex;
    renderImageThumbnail(index);

    if (index === selectedImageIndex) {
         updateImagePreview(imageData.versions[newIndex], `Generated image for: ${currentPostOptions[index].header_text}`, index);
    }
}


// --- Preview and Prompt Modal Functions ---

function handlePreviewDownload() {
    if (!currentPostOptions) return;
    const imageSrc = previewImage.src;
    const postContent = currentPostOptions[selectedImageIndex];
    handleDownloadImage(imageSrc, postContent);
}

function handleShowPrompt() {
    if (!currentPostOptions) return;
    const postContent = currentPostOptions[selectedImageIndex];
    promptModalHeaderInput.value = postContent.header_text;
    promptModalSubheaderInput.value = postContent.subheader_text;
    promptModalImagePromptInput.value = postContent.image_prompt;
    promptModalOverlay.classList.remove('hidden');
}

async function handleRegenerateWithEditedPrompt() {
    if (!currentPostOptions) return;

    const editedPostContent: PostContent = {
        header_text: promptModalHeaderInput.value.trim(),
        subheader_text: promptModalSubheaderInput.value.trim(),
        image_prompt: promptModalImagePromptInput.value.trim(),
    };

    currentPostOptions[selectedImageIndex] = editedPostContent;

    closePromptModal();

    const container = postOptionsGrid.querySelector(`[data-index="${selectedImageIndex}"]`) as HTMLDivElement;
    if (container) {
        const loader = document.createElement('div');
        loader.className = 'thumbnail-loader';
        loader.innerHTML = `<div class="spinner"></div>`;
        container.appendChild(loader);
    }
    
    await generateImage(editedPostContent, selectedImageIndex);
}

function closePromptModal() {
    promptModalOverlay.classList.add('hidden');
}


// --- Settings Functions ---
function openSettings() {
    settingsModalOverlay.classList.remove('hidden');
}

function closeSettings() {
    settingsModalOverlay.classList.add('hidden');
}

function loadSettings() {
    const imagePrompt = localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION;
    const captionPrompt = localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION;
    const temperature = localStorage.getItem('temperature') || '0.9';

    imagePromptInput.value = imagePrompt;
    captionPromptInput.value = captionPrompt;
    temperatureSlider.value = temperature;
    temperatureValue.textContent = temperature;
}

function saveSettings() {
    localStorage.setItem('imagePrompt', imagePromptInput.value);
    localStorage.setItem('captionPrompt', captionPromptInput.value);
    localStorage.setItem('temperature', temperatureSlider.value);
    closeSettings();
    alert('Settings saved!');
}

function resetSettingsToDefaults() {
    if (confirm('Are you sure you want to reset all settings to their defaults?')) {
        localStorage.removeItem('imagePrompt');
        localStorage.removeItem('captionPrompt');
        localStorage.removeItem('temperature');
        loadSettings(); // Reload defaults into the form
        alert('Settings have been reset to default.');
    }
}


// --- Utility Functions ---
function handleCopyCaption() {
    if (captionTextEl) {
        const textToCopy = captionTextEl.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const copyButtonSpan = copyButton.querySelector('span');
            if (copyButtonSpan) {
                copyButtonSpan.textContent = 'Copied!';
                setTimeout(() => {
                    copyButtonSpan.textContent = 'Copy';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy caption.');
        });
    }
}

function handleDownloadImage(imageSrc: string, postContent: PostContent) {
    if (!imageSrc || !postContent) {
        alert("Image is not available for download.");
        return;
    }

    const link = document.createElement('a');
    link.href = imageSrc;
    
    const title = postContent.header_text?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'viral_post';
    link.download = `${title}.png`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleSaveAsPdf() {
    const selectedImageData = imageGenerations.get(selectedImageIndex);
    if (!selectedImageData || !captionTextEl.innerText || !currentPostOptions) {
        alert('Please select an image and generate a caption first.');
        return;
    }

    const imageSrc = selectedImageData.versions[selectedImageData.currentIndex];
    const captionHtml = captionTextEl.innerHTML;
    const topic = ideaInput.value;
    const header = currentPostOptions[selectedImageIndex].header_text;

    const printContent = `
        <div id="print-container">
            <h1>Viral Post</h1>
            <p><strong>Topic:</strong> ${topic}</p>
            <p><strong>Header:</strong> ${header}</p>
            <img src="${imageSrc}" alt="Generated Post Image" />
            <h2>Caption</h2>
            <div class="caption-content">${captionHtml}</div>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Could not open print window. Please disable your pop-up blocker.");
        return;
    }

    printWindow.document.write('<html><head><title>Viral Post - Save as PDF</title>');
    printWindow.document.write(`
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 2rem; color: #333; }
            #print-container { max-width: 700px; margin: auto; }
            h1, h2 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; color: #000; }
            h1 { font-size: 2rem; }
            h2 { font-size: 1.5rem; margin-top: 2rem; }
            img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; margin: 1.5rem 0; }
            .caption-content { white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; font-size: 1.1rem; }
            strong { color: #000; }
            p { font-size: 1.1rem; }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    
    const img = printWindow.document.querySelector('img');

    const doPrint = () => {
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    if (img.complete) {
        doPrint();
    } else {
        img.onload = doPrint;
    }
}